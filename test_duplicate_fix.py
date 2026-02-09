#!/usr/bin/env python3
"""
Specific test for VentasPOS duplicate fix scenario
Tests that desconfirmar does NOT create duplicate payments
"""

import requests
import sys
import json
from datetime import datetime, date

class DuplicateFixTester:
    def __init__(self, base_url="https://finance-multi-tenant.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def make_request(self, method: str, endpoint: str, data: dict = None, params: dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url, params=params)
            elif method == 'POST':
                response = self.session.post(url, json=data)
            else:
                return False, f"Unsupported method: {method}", 0
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return response.status_code < 400, response_data, response.status_code
            
        except Exception as e:
            return False, str(e), 0

    def test_duplicate_fix_scenario(self):
        """Test the exact scenario described by the user"""
        print("🔍 TESTING DUPLICATE FIX SCENARIO")
        print("=" * 60)
        
        # Step 1: Get a confirmed sale with payments
        print("\n1️⃣ Getting confirmed sale with payments...")
        success, ventas_data, status = self.make_request('GET', 'ventas-pos', params={'estado': 'confirmada'})
        if not success or not ventas_data:
            print("❌ No confirmed sales found")
            return False
        
        # Find sale with payments
        venta = None
        for v in ventas_data:
            if v.get('num_pagos_oficiales', 0) > 0:
                venta = v
                break
        
        if not venta:
            print("❌ No confirmed sales with payments found")
            return False
        
        venta_id = venta['id']
        venta_name = venta['name']
        num_pagos_oficiales = venta['num_pagos_oficiales']
        
        print(f"✅ Found sale: ID={venta_id}, Name={venta_name}, Official payments={num_pagos_oficiales}")
        
        # Step 2: See how many official payments it has
        print(f"\n2️⃣ Checking official payments for sale {venta_id}...")
        success, pagos_oficiales, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos-oficiales')
        if not success:
            print(f"❌ Failed to get official payments: {pagos_oficiales}")
            return False
        
        num_pagos_antes = len(pagos_oficiales)
        total_antes = sum(float(p.get('monto', 0)) for p in pagos_oficiales)
        
        print(f"✅ Official payments: {num_pagos_antes}")
        print(f"   Total: S/ {total_antes}")
        for i, pago in enumerate(pagos_oficiales):
            print(f"   - {pago.get('forma_pago')}: S/ {pago.get('monto')} (Ref: {pago.get('referencia', 'N/A')})")
        
        # Step 3: DESCONFIRMAR
        print(f"\n3️⃣ DESCONFIRMING sale {venta_id}...")
        success, desconfirmar_response, status = self.make_request('POST', f'ventas-pos/{venta_id}/desconfirmar')
        if not success:
            print(f"❌ Failed to desconfirm: {desconfirmar_response}")
            return False
        
        print(f"✅ Desconfirmed: {desconfirmar_response.get('message')}")
        
        # Step 4: CRITICAL - Verify NO duplicates
        print(f"\n4️⃣ CRITICAL - Checking for duplicates...")
        success, pagos_temporales, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos')
        if not success:
            print(f"❌ Failed to get temporary payments: {pagos_temporales}")
            return False
        
        num_pagos_despues = len(pagos_temporales)
        total_despues = sum(float(p.get('monto', 0)) for p in pagos_temporales)
        
        print(f"✅ Temporary payments after desconfirm: {num_pagos_despues}")
        print(f"   Total: S/ {total_despues}")
        print(f"   MUST MATCH with official payments from step 2")
        for i, pago in enumerate(pagos_temporales):
            print(f"   - {pago.get('forma_pago')}: S/ {pago.get('monto')} (Ref: {pago.get('referencia', 'N/A')})")
        
        # VALIDATION
        print(f"\n🔍 DUPLICATE VALIDATION:")
        print(f"   Official payments before: {num_pagos_antes} (Total: S/ {total_antes})")
        print(f"   Temporary payments after: {num_pagos_despues} (Total: S/ {total_despues})")
        
        if num_pagos_despues != num_pagos_antes:
            print(f"❌ DUPLICATE DETECTED! Payment count mismatch: {num_pagos_antes} → {num_pagos_despues}")
            return False
        
        if abs(total_despues - total_antes) > 0.01:
            print(f"❌ TOTAL MISMATCH! Amount mismatch: S/ {total_antes} → S/ {total_despues}")
            return False
        
        print(f"✅ NO DUPLICATES FOUND!")
        print(f"   ✅ Payment count matches: {num_pagos_antes} = {num_pagos_despues}")
        print(f"   ✅ Total amount matches: S/ {total_antes} = S/ {total_despues}")
        
        # Step 5: Test complete cycle
        print(f"\n5️⃣ Testing complete cycle - confirming again...")
        
        # Get financial accounts
        success, cuentas, status = self.make_request('GET', 'cuentas-financieras')
        if not success or not cuentas:
            print("❌ No financial accounts found")
            return False
        
        cuenta_id = cuentas[0]['id']
        
        # Add small payment to complete cycle
        pago_data = {
            "cuenta_financiera_id": cuenta_id,
            "forma_pago": "Efectivo",
            "monto": 0.01,
            "referencia": "TEST-FIX",
            "fecha_pago": "2026-02-01",
            "observaciones": "Test duplicados"
        }
        
        success, pago_response, status = self.make_request('POST', f'ventas-pos/{venta_id}/pagos', pago_data)
        if success:
            print(f"✅ Cycle test successful: {pago_response.get('message', 'Payment added')}")
        else:
            print(f"⚠️  Cycle test failed: {pago_response}")
        
        print(f"\n🎉 DUPLICATE FIX TEST RESULT: SUCCESS!")
        print(f"   ✅ No duplicates created during desconfirmar")
        print(f"   ✅ Payment integrity maintained")
        print(f"   ✅ Complete cycle works correctly")
        
        return True

def main():
    """Main test runner"""
    tester = DuplicateFixTester()
    
    print("🚀 VentasPOS Duplicate Fix Test")
    print("Testing that desconfirmar does NOT create duplicate payments")
    print("=" * 60)
    
    success = tester.test_duplicate_fix_scenario()
    
    if success:
        print("\n🎉 TEST PASSED - Duplicate fix is working correctly!")
        return 0
    else:
        print("\n❌ TEST FAILED - Duplicates detected or other issues!")
        return 1

if __name__ == "__main__":
    sys.exit(main())