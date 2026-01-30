#!/usr/bin/env python3
"""
Backend API Testing for Finanzas 4.0 System
Tests all CRUD operations, dashboard KPIs, and business logic
"""

import requests
import sys
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional

class FinanzasAPITester:
    def __init__(self, base_url="https://contaplus-31.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Store created IDs for cleanup and relationships
        self.created_ids = {
            'proveedores': [],
            'facturas': [],
            'pagos': [],
            'letras': []
        }

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

    def test_health_check(self):
        """Test API health endpoint"""
        success, data, status = self.make_request('GET', 'health')
        
        if success and isinstance(data, dict):
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                self.log_test("Health Check", True, "API and database are healthy")
                return True
            else:
                self.log_test("Health Check", False, f"Unhealthy status: {data}")
                return False
        else:
            self.log_test("Health Check", False, f"Failed to get health status: {data}")
            return False

    def test_dashboard_kpis(self):
        """Test dashboard KPIs endpoint"""
        success, data, status = self.make_request('GET', 'dashboard/kpis')
        
        if success and isinstance(data, dict):
            required_fields = [
                'total_cxp', 'total_cxc', 'total_letras_pendientes', 
                'saldo_bancos', 'ventas_mes', 'gastos_mes', 
                'facturas_pendientes', 'letras_por_vencer'
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            if not missing_fields:
                self.log_test("Dashboard KPIs", True, f"All KPI fields present. Saldo bancos: {data.get('saldo_bancos', 0)}")
                return True
            else:
                self.log_test("Dashboard KPIs", False, f"Missing fields: {missing_fields}")
                return False
        else:
            self.log_test("Dashboard KPIs", False, f"Failed to get KPIs: {data}")
            return False

    def test_seed_data(self):
        """Test that seed data was created correctly"""
        tests_passed = 0
        total_tests = 5
        
        # Test empresa
        success, data, status = self.make_request('GET', 'empresas')
        if success and isinstance(data, list) and len(data) > 0:
            empresa = data[0]
            if empresa.get('nombre') == 'Mi Empresa S.A.C.' and empresa.get('ruc') == '20123456789':
                self.log_test("Seed Data - Empresa", True, f"Empresa found: {empresa['nombre']}")
                tests_passed += 1
            else:
                self.log_test("Seed Data - Empresa", False, f"Incorrect empresa data: {empresa}")
        else:
            self.log_test("Seed Data - Empresa", False, f"No empresa found: {data}")
        
        # Test monedas
        success, data, status = self.make_request('GET', 'monedas')
        if success and isinstance(data, list):
            pen_found = any(m.get('codigo') == 'PEN' and m.get('es_principal') for m in data)
            usd_found = any(m.get('codigo') == 'USD' for m in data)
            if pen_found and usd_found:
                self.log_test("Seed Data - Monedas", True, "PEN and USD currencies found")
                tests_passed += 1
            else:
                self.log_test("Seed Data - Monedas", False, f"Missing currencies. PEN: {pen_found}, USD: {usd_found}")
        else:
            self.log_test("Seed Data - Monedas", False, f"Failed to get monedas: {data}")
        
        # Test categorías
        success, data, status = self.make_request('GET', 'categorias')
        if success and isinstance(data, list) and len(data) >= 8:
            egreso_cats = [c for c in data if c.get('tipo') == 'egreso']
            if len(egreso_cats) >= 6:
                self.log_test("Seed Data - Categorías", True, f"Found {len(egreso_cats)} egreso categories")
                tests_passed += 1
            else:
                self.log_test("Seed Data - Categorías", False, f"Only {len(egreso_cats)} egreso categories found")
        else:
            self.log_test("Seed Data - Categorías", False, f"Insufficient categories: {len(data) if isinstance(data, list) else 'error'}")
        
        # Test cuentas financieras
        success, data, status = self.make_request('GET', 'cuentas-financieras')
        if success and isinstance(data, list) and len(data) >= 2:
            banco_found = any(c.get('tipo') == 'banco' and 'BCP' in c.get('nombre', '') for c in data)
            caja_found = any(c.get('tipo') == 'caja' for c in data)
            if banco_found and caja_found:
                self.log_test("Seed Data - Cuentas Financieras", True, "Bank and cash accounts found")
                tests_passed += 1
            else:
                self.log_test("Seed Data - Cuentas Financieras", False, f"Missing accounts. Bank: {banco_found}, Cash: {caja_found}")
        else:
            self.log_test("Seed Data - Cuentas Financieras", False, f"Insufficient accounts: {len(data) if isinstance(data, list) else 'error'}")
        
        # Test proveedor
        success, data, status = self.make_request('GET', 'proveedores')
        if success and isinstance(data, list) and len(data) > 0:
            proveedor = data[0]
            if proveedor.get('numero_documento') == '20987654321' and proveedor.get('es_proveedor'):
                self.log_test("Seed Data - Proveedor", True, f"Demo supplier found: {proveedor['nombre']}")
                tests_passed += 1
            else:
                self.log_test("Seed Data - Proveedor", False, f"Incorrect supplier data: {proveedor}")
        else:
            self.log_test("Seed Data - Proveedor", False, f"No supplier found: {data}")
        
        return tests_passed == total_tests

    def test_crud_proveedores(self):
        """Test CRUD operations for proveedores"""
        # Create proveedor
        proveedor_data = {
            "tipo_documento": "RUC",
            "numero_documento": "20123456780",
            "nombre": "Test Proveedor S.A.C.",
            "direccion": "Av. Test 123",
            "telefono": "01-9876543",
            "email": "test@proveedor.com",
            "es_proveedor": True,
            "terminos_pago_dias": 30
        }
        
        success, data, status = self.make_request('POST', 'terceros', proveedor_data)
        if success and isinstance(data, dict) and 'id' in data:
            proveedor_id = data['id']
            self.created_ids['proveedores'].append(proveedor_id)
            self.log_test("CRUD Proveedores - Create", True, f"Created proveedor ID: {proveedor_id}")
            
            # Read proveedor
            success, data, status = self.make_request('GET', f'terceros/{proveedor_id}')
            if success and data.get('nombre') == proveedor_data['nombre']:
                self.log_test("CRUD Proveedores - Read", True, f"Retrieved proveedor: {data['nombre']}")
                
                # List proveedores
                success, data, status = self.make_request('GET', 'proveedores')
                if success and isinstance(data, list):
                    found = any(p.get('id') == proveedor_id for p in data)
                    if found:
                        self.log_test("CRUD Proveedores - List", True, f"Proveedor found in list")
                        return True
                    else:
                        self.log_test("CRUD Proveedores - List", False, "Proveedor not found in list")
                else:
                    self.log_test("CRUD Proveedores - List", False, f"Failed to list proveedores: {data}")
            else:
                self.log_test("CRUD Proveedores - Read", False, f"Failed to read proveedor: {data}")
        else:
            self.log_test("CRUD Proveedores - Create", False, f"Failed to create proveedor: {data}")
        
        return False

    def test_crud_facturas_proveedor(self):
        """Test CRUD operations for facturas proveedor"""
        # Get proveedor and moneda for the test
        success, proveedores, status = self.make_request('GET', 'proveedores')
        success2, monedas, status2 = self.make_request('GET', 'monedas')
        success3, categorias, status3 = self.make_request('GET', 'categorias', params={'tipo': 'egreso'})
        
        if not (success and success2 and success3 and proveedores and monedas and categorias):
            self.log_test("CRUD Facturas - Prerequisites", False, "Missing required data")
            return False
        
        proveedor_id = proveedores[0]['id']
        moneda_id = next((m['id'] for m in monedas if m['codigo'] == 'PEN'), monedas[0]['id'])
        categoria_id = categorias[0]['id']
        
        # Create factura
        factura_data = {
            "proveedor_id": proveedor_id,
            "moneda_id": moneda_id,
            "fecha_factura": date.today().isoformat(),
            "terminos_dias": 30,
            "tipo_documento": "factura",
            "impuestos_incluidos": False,
            "notas": "Factura de prueba",
            "lineas": [
                {
                    "categoria_id": categoria_id,
                    "descripcion": "Servicio de prueba",
                    "importe": 1000.0,
                    "igv_aplica": True
                }
            ]
        }
        
        success, data, status = self.make_request('POST', 'facturas-proveedor', factura_data)
        print(f"DEBUG: Factura creation - Status: {status}, Success: {success}, Data: {data}")
        if success and isinstance(data, dict) and 'id' in data:
            factura_id = data['id']
            self.created_ids['facturas'].append(factura_id)
            
            # Verify totals calculation
            expected_subtotal = 1000.0
            expected_igv = 180.0  # 18% of 1000
            expected_total = 1180.0
            
            if (abs(data.get('subtotal', 0) - expected_subtotal) < 0.01 and
                abs(data.get('igv', 0) - expected_igv) < 0.01 and
                abs(data.get('total', 0) - expected_total) < 0.01):
                self.log_test("CRUD Facturas - Create & Totals", True, 
                            f"Created factura ID: {factura_id}, Total: {data['total']}")
                
                # Verify CxP was created automatically
                success, cxp_data, status = self.make_request('GET', 'cxp')
                if success and isinstance(cxp_data, list):
                    cxp_found = any(c.get('factura_id') == factura_id for c in cxp_data)
                    if cxp_found:
                        self.log_test("Auto CxP Creation", True, "CxP created automatically for factura")
                        return True
                    else:
                        self.log_test("Auto CxP Creation", False, "CxP not found for factura")
                else:
                    self.log_test("Auto CxP Creation", False, f"Failed to check CxP: {cxp_data}")
            else:
                self.log_test("CRUD Facturas - Create & Totals", False, 
                            f"Incorrect totals. Expected: {expected_total}, Got: {data.get('total')}")
        else:
            self.log_test("CRUD Facturas - Create", False, f"Failed to create factura: {data}")
        
        return False

    def test_pagos_functionality(self):
        """Test payment functionality with partial payments"""
        if not self.created_ids['facturas']:
            self.log_test("Pagos - No Factura", False, "No factura available for payment test")
            return False
        
        factura_id = self.created_ids['facturas'][0]
        
        # Get factura details
        success, factura, status = self.make_request('GET', f'facturas-proveedor/{factura_id}')
        if not success:
            self.log_test("Pagos - Get Factura", False, f"Failed to get factura: {factura}")
            return False
        
        # Get cuenta financiera and moneda
        success, cuentas, status = self.make_request('GET', 'cuentas-financieras')
        success2, monedas, status2 = self.make_request('GET', 'monedas')
        
        if not (success and success2 and cuentas and monedas):
            self.log_test("Pagos - Prerequisites", False, "Missing required data for payment")
            return False
        
        cuenta_id = cuentas[0]['id']
        moneda_id = next((m['id'] for m in monedas if m['codigo'] == 'PEN'), monedas[0]['id'])
        
        # Make partial payment (50% of total)
        total_factura = factura['total']
        monto_pago = total_factura * 0.5
        
        pago_data = {
            "tipo": "egreso",
            "fecha": date.today().isoformat(),
            "cuenta_financiera_id": cuenta_id,
            "moneda_id": moneda_id,
            "monto_total": monto_pago,
            "referencia": "Pago parcial de prueba",
            "detalles": [
                {
                    "cuenta_financiera_id": cuenta_id,
                    "medio_pago": "transferencia",
                    "monto": monto_pago,
                    "referencia": "TRF-001"
                }
            ],
            "aplicaciones": [
                {
                    "tipo_documento": "factura",
                    "documento_id": factura_id,
                    "monto_aplicado": monto_pago
                }
            ]
        }
        
        success, data, status = self.make_request('POST', 'pagos', pago_data)
        if success and isinstance(data, dict) and 'id' in data:
            pago_id = data['id']
            self.created_ids['pagos'].append(pago_id)
            
            # Verify factura saldo_pendiente was updated
            success, factura_updated, status = self.make_request('GET', f'facturas-proveedor/{factura_id}')
            if success:
                expected_saldo = total_factura - monto_pago
                actual_saldo = factura_updated.get('saldo_pendiente', 0)
                
                if abs(actual_saldo - expected_saldo) < 0.01:
                    # Check if estado changed to 'parcial'
                    if factura_updated.get('estado') == 'parcial':
                        self.log_test("Pagos - Partial Payment", True, 
                                    f"Partial payment successful. Remaining: {actual_saldo}")
                        return True
                    else:
                        self.log_test("Pagos - Estado Update", False, 
                                    f"Estado not updated to 'parcial': {factura_updated.get('estado')}")
                else:
                    self.log_test("Pagos - Saldo Update", False, 
                                f"Saldo not updated correctly. Expected: {expected_saldo}, Got: {actual_saldo}")
            else:
                self.log_test("Pagos - Verify Update", False, f"Failed to verify payment update: {factura_updated}")
        else:
            self.log_test("Pagos - Create Payment", False, f"Failed to create payment: {data}")
        
        return False

    def test_letras_functionality(self):
        """Test letras generation from factura"""
        if not self.created_ids['facturas']:
            self.log_test("Letras - No Factura", False, "No factura available for letras test")
            return False
        
        factura_id = self.created_ids['facturas'][0]
        
        # Generate letras from factura
        letras_data = {
            "factura_id": factura_id,
            "cantidad_letras": 3,
            "dias_entre_letras": 30
        }
        
        success, data, status = self.make_request('POST', 'letras/generar', letras_data)
        if success and isinstance(data, list) and len(data) == 3:
            # Store letra IDs for cleanup
            for letra in data:
                if 'id' in letra:
                    self.created_ids['letras'].append(letra['id'])
            
            # Verify factura estado changed to 'canjeado'
            success, factura, status = self.make_request('GET', f'facturas-proveedor/{factura_id}')
            if success and factura.get('estado') == 'canjeado':
                self.log_test("Letras - Generation", True, 
                            f"Generated {len(data)} letras, factura status: canjeado")
                return True
            else:
                self.log_test("Letras - Estado Update", False, 
                            f"Factura estado not updated to 'canjeado': {factura.get('estado')}")
        else:
            self.log_test("Letras - Generation", False, f"Failed to generate letras: {data}")
        
        return False

    def cleanup_test_data(self):
        """Clean up created test data"""
        cleanup_count = 0
        
        # Delete letras
        for letra_id in self.created_ids['letras']:
            success, _, _ = self.make_request('DELETE', f'letras/{letra_id}')
            if success:
                cleanup_count += 1
        
        # Delete pagos
        for pago_id in self.created_ids['pagos']:
            success, _, _ = self.make_request('DELETE', f'pagos/{pago_id}')
            if success:
                cleanup_count += 1
        
        # Delete facturas
        for factura_id in self.created_ids['facturas']:
            success, _, _ = self.make_request('DELETE', f'facturas-proveedor/{factura_id}')
            if success:
                cleanup_count += 1
        
        # Delete proveedores (soft delete)
        for proveedor_id in self.created_ids['proveedores']:
            success, _, _ = self.make_request('DELETE', f'terceros/{proveedor_id}')
            if success:
                cleanup_count += 1
        
        print(f"\n🧹 Cleaned up {cleanup_count} test records")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Finanzas 4.0 Backend API Tests")
        print(f"📡 Testing API at: {self.base_url}")
        print("=" * 60)
        
        # Core functionality tests
        tests = [
            ("Health Check", self.test_health_check),
            ("Dashboard KPIs", self.test_dashboard_kpis),
            ("Seed Data Verification", self.test_seed_data),
            ("CRUD Proveedores", self.test_crud_proveedores),
            ("CRUD Facturas Proveedor", self.test_crud_facturas_proveedor),
            ("Pagos Functionality", self.test_pagos_functionality),
            ("Letras Functionality", self.test_letras_functionality),
        ]
        
        for test_name, test_func in tests:
            print(f"\n📋 Running: {test_name}")
            try:
                test_func()
            except Exception as e:
                self.log_test(test_name, False, f"Exception: {str(e)}")
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            
            # Show failed tests
            failed_tests = [t for t in self.test_results if not t['success']]
            if failed_tests:
                print("\n❌ Failed Tests:")
                for test in failed_tests:
                    print(f"  - {test['name']}: {test['details']}")
            
            return 1

def main():
    """Main test runner"""
    tester = FinanzasAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())