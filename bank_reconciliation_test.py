#!/usr/bin/env python3
"""
Bank Reconciliation Testing for Finanzas 4.0 System
Tests the specific bank reconciliation save functionality
"""

import requests
import sys
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional

class BankReconciliationTester:
    def __init__(self, base_url="https://finanzas-fix.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            'name': name,
            'success': success,
            'details': details,
            'response_data': response_data
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url, params=params)
            elif method == 'POST':
                response = self.session.post(url, json=data)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            elif method == 'DELETE':
                response = self.session.delete(url)
            else:
                return False, f"Unsupported method: {method}", 0
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return response.status_code < 400, response_data, response.status_code
            
        except Exception as e:
            return False, str(e), 0

    def test_bank_reconciliation_prerequisites(self):
        """Test that we have the necessary data for bank reconciliation"""
        print("🔍 Checking prerequisites for bank reconciliation...")
        
        # Check bank accounts
        success, cuentas, status = self.make_request('GET', 'cuentas-financieras', params={'tipo': 'banco'})
        if not success or not cuentas:
            self.log_test("Prerequisites - Bank Accounts", False, "No bank accounts found")
            return False, None
        
        cuenta_id = cuentas[0]['id']
        cuenta_nombre = cuentas[0]['nombre']
        self.log_test("Prerequisites - Bank Accounts", True, f"Found bank account: {cuenta_nombre} (ID: {cuenta_id})")
        
        return True, cuenta_id

    def test_bank_movements_endpoint(self, cuenta_id):
        """Test the bank movements endpoint"""
        print("🏦 Testing bank movements endpoint...")
        
        # Test getting unprocessed bank movements
        success, movimientos, status = self.make_request('GET', 'conciliacion/movimientos-banco', 
                                                        params={'cuenta_financiera_id': cuenta_id, 'procesado': False})
        
        if success:
            self.log_test("Bank Movements - Unprocessed", True, 
                         f"Found {len(movimientos)} unprocessed bank movements")
            return movimientos
        else:
            self.log_test("Bank Movements - Unprocessed", False, f"Failed to get movements: {movimientos}")
            return []

    def test_system_payments_endpoint(self, cuenta_id):
        """Test the system payments endpoint"""
        print("💳 Testing system payments endpoint...")
        
        # Get payments for the account
        today = date.today()
        last_month = today - timedelta(days=30)
        
        success, pagos, status = self.make_request('GET', 'pagos', 
                                                  params={
                                                      'cuenta_financiera_id': cuenta_id,
                                                      'fecha_desde': last_month.isoformat(),
                                                      'fecha_hasta': today.isoformat()
                                                  })
        
        if success:
            # Filter for non-reconciled payments
            non_reconciled = [p for p in pagos if not p.get('conciliado', False)]
            self.log_test("System Payments - Non-reconciled", True, 
                         f"Found {len(non_reconciled)} non-reconciled payments")
            return non_reconciled
        else:
            self.log_test("System Payments - Non-reconciled", False, f"Failed to get payments: {pagos}")
            return []

    def test_reconciliation_endpoint(self, banco_ids, pago_ids):
        """Test the main reconciliation endpoint"""
        print("🔗 Testing bank reconciliation save endpoint...")
        
        if not banco_ids or not pago_ids:
            self.log_test("Reconciliation - Insufficient Data", False, 
                         f"Need both bank movements and payments. Got: {len(banco_ids)} bank, {len(pago_ids)} payments")
            return False
        
        # Build query string
        query_params = []
        for banco_id in banco_ids:
            query_params.append(f"banco_ids={banco_id}")
        for pago_id in pago_ids:
            query_params.append(f"pago_ids={pago_id}")
        
        query_string = "&".join(query_params)
        
        # Make the reconciliation request
        success, data, status = self.make_request('POST', f'conciliacion/conciliar?{query_string}')
        
        if success and isinstance(data, dict):
            expected_banco_count = len(banco_ids)
            expected_pago_count = len(pago_ids)
            
            banco_conciliados = data.get('banco_conciliados', 0)
            sistema_conciliados = data.get('sistema_conciliados', 0)
            
            if (banco_conciliados == expected_banco_count and 
                sistema_conciliados == expected_pago_count):
                
                self.log_test("Reconciliation - API Response", True, 
                            f"Successfully reconciled {banco_conciliados} bank movements and {sistema_conciliados} payments")
                
                # Verify the response message
                expected_message = f"Conciliados {expected_banco_count} movimientos del banco y {expected_pago_count} del sistema"
                if data.get('message') == expected_message:
                    self.log_test("Reconciliation - Response Message", True, "Correct response message format")
                else:
                    self.log_test("Reconciliation - Response Message", False, 
                                f"Unexpected message: {data.get('message')}")
                
                return True
            else:
                self.log_test("Reconciliation - API Response", False,
                            f"Incorrect counts. Expected: {expected_banco_count}/{expected_pago_count}, Got: {banco_conciliados}/{sistema_conciliados}")
        else:
            self.log_test("Reconciliation - API Response", False, f"Failed to reconcile: {data}")
        
        return False

    def test_database_updates(self, cuenta_id, banco_ids, pago_ids):
        """Test that database was updated correctly"""
        print("🗄️ Verifying database updates...")
        
        # Check that bank movements are marked as procesado=TRUE
        success, processed_movements, status = self.make_request('GET', 'conciliacion/movimientos-banco',
                                                               params={'cuenta_financiera_id': cuenta_id, 'procesado': True})
        
        if success:
            processed_ids = [mov['id'] for mov in processed_movements if mov.get('procesado')]
            reconciled_found = all(bid in processed_ids for bid in banco_ids)
            
            if reconciled_found:
                self.log_test("Database - Bank Movements Updated", True,
                            f"All {len(banco_ids)} bank movements marked as procesado=TRUE")
            else:
                missing_ids = [bid for bid in banco_ids if bid not in processed_ids]
                self.log_test("Database - Bank Movements Updated", False,
                            f"Bank movements not properly updated. Missing IDs: {missing_ids}")
        else:
            self.log_test("Database - Bank Movements Updated", False,
                        f"Failed to verify bank movements: {processed_movements}")
        
        # Check that payments are marked as conciliado=TRUE
        success, all_pagos, status = self.make_request('GET', 'pagos')
        
        if success:
            reconciled_pagos = [p for p in all_pagos if p.get('conciliado', False) and p['id'] in pago_ids]
            
            if len(reconciled_pagos) == len(pago_ids):
                self.log_test("Database - Payments Updated", True,
                            f"All {len(pago_ids)} payments marked as conciliado=TRUE")
            else:
                self.log_test("Database - Payments Updated", False,
                            f"Only {len(reconciled_pagos)} of {len(pago_ids)} payments marked as reconciled")
        else:
            self.log_test("Database - Payments Updated", False,
                        f"Failed to verify payments: {all_pagos}")

    def test_edge_cases(self):
        """Test edge cases and error handling"""
        print("⚠️ Testing edge cases...")
        
        # Test with empty arrays
        success, data, status = self.make_request('POST', 'conciliacion/conciliar?banco_ids=&pago_ids=')
        if not success or status >= 400:
            self.log_test("Edge Case - Empty Arrays", True, "Correctly handled empty arrays")
        else:
            self.log_test("Edge Case - Empty Arrays", False, "Should have failed with empty arrays")
        
        # Test with invalid IDs
        success, data, status = self.make_request('POST', 'conciliacion/conciliar?banco_ids=99999&pago_ids=99999')
        # This might succeed but update 0 records, which is acceptable
        if success and isinstance(data, dict):
            if data.get('banco_conciliados', 0) == 0 and data.get('sistema_conciliados', 0) == 0:
                self.log_test("Edge Case - Invalid IDs", True, "Correctly handled invalid IDs (0 updates)")
            else:
                self.log_test("Edge Case - Invalid IDs", False, f"Unexpected result with invalid IDs: {data}")
        else:
            self.log_test("Edge Case - Invalid IDs", True, "Correctly rejected invalid IDs")

    def run_comprehensive_test(self):
        """Run comprehensive bank reconciliation test"""
        print("🚀 Starting Bank Reconciliation Comprehensive Test")
        print(f"📡 Testing API at: {self.base_url}")
        print("=" * 70)
        
        # Step 1: Check prerequisites
        prereq_success, cuenta_id = self.test_bank_reconciliation_prerequisites()
        if not prereq_success:
            print("❌ Prerequisites failed. Cannot continue with reconciliation tests.")
            return False
        
        # Step 2: Get test data
        bank_movements = self.test_bank_movements_endpoint(cuenta_id)
        system_payments = self.test_system_payments_endpoint(cuenta_id)
        
        # Take a subset for testing (max 2 of each)
        banco_ids = [mov['id'] for mov in bank_movements[:2]]
        pago_ids = [pago['id'] for pago in system_payments[:2]]
        
        if not banco_ids or not pago_ids:
            print("⚠️ Insufficient test data. Creating minimal test scenario...")
            # If no real data, we can still test the API with mock IDs
            banco_ids = [1, 2]  # These might not exist, but we can test the API
            pago_ids = [1, 2]
        
        print(f"📊 Test data: {len(banco_ids)} bank movements, {len(pago_ids)} payments")
        
        # Step 3: Test the reconciliation endpoint
        reconciliation_success = self.test_reconciliation_endpoint(banco_ids, pago_ids)
        
        # Step 4: Verify database updates (only if reconciliation succeeded)
        if reconciliation_success:
            self.test_database_updates(cuenta_id, banco_ids, pago_ids)
        
        # Step 5: Test edge cases
        self.test_edge_cases()
        
        # Summary
        print("\n" + "=" * 70)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All bank reconciliation tests passed!")
            return True
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            
            # Show failed tests
            failed_tests = [t for t in self.test_results if not t['success']]
            if failed_tests:
                print("\n❌ Failed Tests:")
                for test in failed_tests:
                    print(f"  - {test['name']}: {test['details']}")
            
            return False

def main():
    """Main test runner"""
    tester = BankReconciliationTester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())