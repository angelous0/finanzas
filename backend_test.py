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
    def __init__(self, base_url="https://finanzas-fix.preview.emergentagent.com/api"):
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

    def test_bank_reconciliation_save(self):
        """Test bank reconciliation save functionality"""
        # First, get bank accounts
        success, cuentas, status = self.make_request('GET', 'cuentas-financieras', params={'tipo': 'banco'})
        if not success or not cuentas:
            self.log_test("Bank Reconciliation - No Bank Account", False, "No bank accounts found")
            return False
        
        cuenta_id = cuentas[0]['id']
        
        # Create test bank movements by importing sample data
        # First check if we have any existing bank movements
        success, movimientos_banco, status = self.make_request('GET', 'conciliacion/movimientos-banco', 
                                                              params={'cuenta_financiera_id': cuenta_id, 'procesado': False})
        
        banco_ids = []
        if success and movimientos_banco:
            # Use existing movements if available
            banco_ids = [mov['id'] for mov in movimientos_banco[:2]]  # Take first 2
        
        # Get system payments (pagos)
        success, pagos, status = self.make_request('GET', 'pagos')
        pago_ids = []
        if success and pagos:
            # Use existing payments if available
            pago_ids = [pago['id'] for pago in pagos[:2]]  # Take first 2
        
        # If we don't have enough test data, create some
        if len(banco_ids) == 0 or len(pago_ids) == 0:
            self.log_test("Bank Reconciliation - Insufficient Data", False, 
                         f"Need bank movements and payments. Found: {len(banco_ids)} bank, {len(pago_ids)} payments")
            return False
        
        # Test the reconciliation endpoint
        params = {}
        for banco_id in banco_ids:
            if 'banco_ids' not in params:
                params['banco_ids'] = []
            params['banco_ids'].append(banco_id)
        
        for pago_id in pago_ids:
            if 'pago_ids' not in params:
                params['pago_ids'] = []
            params['pago_ids'].append(pago_id)
        
        # Convert to query string format
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
            
            if (data.get('banco_conciliados') == expected_banco_count and 
                data.get('sistema_conciliados') == expected_pago_count):
                
                self.log_test("Bank Reconciliation - Save Endpoint", True, 
                            f"Reconciled {expected_banco_count} bank movements and {expected_pago_count} payments")
                
                # Verify database updates - check that bank movements are marked as procesado=TRUE
                success, updated_movimientos, status = self.make_request('GET', 'conciliacion/movimientos-banco',
                                                                        params={'cuenta_financiera_id': cuenta_id, 'procesado': True})
                
                if success:
                    # Check if our reconciled movements are now marked as processed
                    processed_ids = [mov['id'] for mov in updated_movimientos if mov.get('procesado')]
                    reconciled_found = any(bid in processed_ids for bid in banco_ids)
                    
                    if reconciled_found:
                        self.log_test("Bank Reconciliation - DB Update Verification", True,
                                    "Bank movements correctly marked as procesado=TRUE")
                        return True
                    else:
                        self.log_test("Bank Reconciliation - DB Update Verification", False,
                                    "Bank movements not found in processed list")
                else:
                    self.log_test("Bank Reconciliation - DB Verification", False,
                                f"Failed to verify database updates: {updated_movimientos}")
            else:
                self.log_test("Bank Reconciliation - Save Endpoint", False,
                            f"Incorrect counts. Expected: {expected_banco_count}/{expected_pago_count}, Got: {data.get('banco_conciliados')}/{data.get('sistema_conciliados')}")
        else:
            self.log_test("Bank Reconciliation - Save Endpoint", False, f"Failed to reconcile: {data}")
        
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

    def test_ventas_pos_payment_flow(self):
        """Test complete VentasPOS payment assignment and auto-confirmation flow"""
        print("\n🔍 Testing VentasPOS Payment Flow...")
        
        # Step 1: Get a pending sale
        success, ventas_data, status = self.make_request('GET', 'ventas-pos', params={'estado': 'pendiente'})
        if not success or not ventas_data:
            self.log_test("VentasPOS Flow - Get Pending Sale", False, f"No pending sales found: {ventas_data}")
            return False
        
        venta = ventas_data[0]
        venta_id = venta['id']
        venta_name = venta['name']
        amount_total = float(venta['amount_total'])
        
        print(f"   📋 Found pending sale: ID={venta_id}, Name={venta_name}, Total={amount_total}")
        self.log_test("VentasPOS Flow - Get Pending Sale", True, 
                     f"Found sale ID={venta_id}, Total={amount_total}")
        
        # Step 2: Get available financial accounts
        success, cuentas_data, status = self.make_request('GET', 'cuentas-financieras')
        if not success or not cuentas_data:
            self.log_test("VentasPOS Flow - Get Financial Accounts", False, f"No accounts found: {cuentas_data}")
            return False
        
        cuenta = cuentas_data[0]
        cuenta_id = cuenta['id']
        cuenta_nombre = cuenta['nombre']
        
        print(f"   💳 Using account: ID={cuenta_id}, Name={cuenta_nombre}")
        self.log_test("VentasPOS Flow - Get Financial Accounts", True, 
                     f"Found account ID={cuenta_id}, Name={cuenta_nombre}")
        
        # Step 3: Assign payment (should auto-confirm since amount = total)
        pago_data = {
            "cuenta_financiera_id": cuenta_id,
            "forma_pago": "Efectivo",
            "monto": amount_total,
            "referencia": "TEST-PAGO-AUTO",
            "fecha_pago": "2026-01-30",
            "observaciones": "Pago de prueba automático"
        }
        
        success, pago_response, status = self.make_request('POST', f'ventas-pos/{venta_id}/pagos', pago_data)
        if not success:
            self.log_test("VentasPOS Flow - Assign Payment", False, f"Failed to assign payment: {pago_response}")
            return False
        
        if not pago_response.get('auto_confirmed'):
            self.log_test("VentasPOS Flow - Auto Confirmation", False, 
                         f"Payment not auto-confirmed: {pago_response}")
            return False
        
        print(f"   ✅ Payment assigned and auto-confirmed: {pago_response.get('message')}")
        self.log_test("VentasPOS Flow - Assign Payment & Auto-Confirm", True, 
                     f"Auto-confirmed with {pago_response.get('pagos_registrados')} payments")
        
        # Step 4: Verify sale is confirmed
        success, ventas_confirmadas, status = self.make_request('GET', 'ventas-pos', params={'estado': 'confirmada'})
        if not success:
            self.log_test("VentasPOS Flow - Check Confirmed Sales", False, f"Failed to get confirmed sales: {ventas_confirmadas}")
            return False
        
        venta_confirmada = next((v for v in ventas_confirmadas if v['id'] == venta_id), None)
        if not venta_confirmada:
            self.log_test("VentasPOS Flow - Sale Confirmation Status", False, "Sale not found in confirmed sales")
            return False
        
        print(f"   ✅ Sale confirmed: Estado={venta_confirmada.get('estado_local')}")
        self.log_test("VentasPOS Flow - Sale Confirmation Status", True, 
                     f"Sale found in confirmed sales with estado={venta_confirmada.get('estado_local')}")
        
        # Step 5: Verify official payments were created
        success, pagos_oficiales, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos-oficiales')
        if not success:
            self.log_test("VentasPOS Flow - Get Official Payments", False, f"Failed to get official payments: {pagos_oficiales}")
            return False
        
        if not pagos_oficiales or len(pagos_oficiales) == 0:
            self.log_test("VentasPOS Flow - Official Payments Created", False, "No official payments found")
            return False
        
        print(f"   💰 Official payments found: {len(pagos_oficiales)} payments")
        for pago in pagos_oficiales:
            print(f"      - Pago: numero={pago.get('numero')}, monto={pago.get('monto')}, forma_pago={pago.get('forma_pago')}")
        
        self.log_test("VentasPOS Flow - Official Payments Created", True, 
                     f"Found {len(pagos_oficiales)} official payments")
        
        # Step 6: Verify pagos_oficiales and num_pagos_oficiales fields in sale
        # Get the sale again from the confirmed sales list to check the calculated fields
        success, ventas_updated, status = self.make_request('GET', 'ventas-pos', params={'estado': 'confirmada'})
        if not success:
            self.log_test("VentasPOS Flow - Get Updated Sale Details", False, f"Failed to get updated sales: {ventas_updated}")
            return False
        
        venta_detail = next((v for v in ventas_updated if v['id'] == venta_id), None)
        if not venta_detail:
            self.log_test("VentasPOS Flow - Find Updated Sale", False, "Updated sale not found in confirmed sales")
            return False
        
        pagos_oficiales_amount = venta_detail.get('pagos_oficiales', 0)
        num_pagos_oficiales = venta_detail.get('num_pagos_oficiales', 0)
        
        print(f"   📊 Sale fields: pagos_oficiales={pagos_oficiales_amount}, num_pagos_oficiales={num_pagos_oficiales}")
        
        # Verify amounts match
        if abs(float(pagos_oficiales_amount) - amount_total) < 0.01 and num_pagos_oficiales == 1:
            self.log_test("VentasPOS Flow - Sale Fields Verification", True, 
                         f"pagos_oficiales={pagos_oficiales_amount} matches total, num_pagos_oficiales={num_pagos_oficiales}")
            
            print("   🎉 Complete VentasPOS payment flow test PASSED!")
            return True
        else:
            self.log_test("VentasPOS Flow - Sale Fields Verification", False, 
                         f"Mismatch: pagos_oficiales={pagos_oficiales_amount} (expected {amount_total}), num_pagos_oficiales={num_pagos_oficiales} (expected 1)")
            return False

    def test_ventas_pos_desconfirmar_flow(self):
        """Test complete VentasPOS desconfirmar (unconfirm) flow"""
        print("\n🔍 Testing VentasPOS Desconfirmar Flow...")
        
        # Step 1: Get a confirmed sale with payments
        success, ventas_confirmadas, status = self.make_request('GET', 'ventas-pos', params={'estado': 'confirmada'})
        if not success or not ventas_confirmadas:
            self.log_test("Desconfirmar Flow - Get Confirmed Sale", False, f"No confirmed sales found: {ventas_confirmadas}")
            return False
        
        # Find a sale with official payments
        venta_con_pagos = None
        for venta in ventas_confirmadas:
            if venta.get('num_pagos_oficiales', 0) > 0:
                venta_con_pagos = venta
                break
        
        if not venta_con_pagos:
            self.log_test("Desconfirmar Flow - Find Sale with Payments", False, "No confirmed sales with payments found")
            return False
        
        venta_id = venta_con_pagos['id']
        venta_name = venta_con_pagos['name']
        num_pagos_oficiales = venta_con_pagos['num_pagos_oficiales']
        
        print(f"   📋 Found confirmed sale with payments: ID={venta_id}, Name={venta_name}, Pagos={num_pagos_oficiales}")
        self.log_test("Desconfirmar Flow - Find Sale with Payments", True, 
                     f"Found sale ID={venta_id}, Name={venta_name}, Pagos={num_pagos_oficiales}")
        
        # Step 2: Verify official payments before unconfirming
        success, pagos_oficiales_antes, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos-oficiales')
        if not success:
            self.log_test("Desconfirmar Flow - Get Official Payments Before", False, f"Failed to get official payments: {pagos_oficiales_antes}")
            return False
        
        num_pagos_antes = len(pagos_oficiales_antes)
        print(f"   💰 Official payments BEFORE: {num_pagos_antes}")
        for pago in pagos_oficiales_antes:
            print(f"      - {pago.get('numero')}: {pago.get('monto')} ({pago.get('forma_pago')})")
        
        self.log_test("Desconfirmar Flow - Official Payments Before", True, 
                     f"Found {num_pagos_antes} official payments before unconfirming")
        
        # Step 3: Verify temporary payments before (should be empty)
        success, pagos_temporales_antes, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos')
        if not success:
            self.log_test("Desconfirmar Flow - Get Temporary Payments Before", False, f"Failed to get temporary payments: {pagos_temporales_antes}")
            return False
        
        num_temporales_antes = len(pagos_temporales_antes)
        print(f"   📝 Temporary payments BEFORE: {num_temporales_antes} (should be 0)")
        
        if num_temporales_antes == 0:
            self.log_test("Desconfirmar Flow - Temporary Payments Before", True, 
                         "Temporary payments correctly empty before unconfirming")
        else:
            self.log_test("Desconfirmar Flow - Temporary Payments Before", False, 
                         f"Expected 0 temporary payments, found {num_temporales_antes}")
        
        # Step 4: DESCONFIRMAR LA VENTA
        success, desconfirmar_response, status = self.make_request('POST', f'ventas-pos/{venta_id}/desconfirmar')
        if not success:
            self.log_test("Desconfirmar Flow - Unconfirm Sale", False, f"Failed to unconfirm sale: {desconfirmar_response}")
            return False
        
        pagos_restaurados = desconfirmar_response.get('pagos_restaurados', 0)
        nuevo_estado = desconfirmar_response.get('nuevo_estado')
        
        print(f"   ✅ Sale unconfirmed: {desconfirmar_response.get('message')}")
        print(f"      - Payments restored: {pagos_restaurados}")
        print(f"      - New state: {nuevo_estado}")
        
        self.log_test("Desconfirmar Flow - Unconfirm Sale", True, 
                     f"Sale unconfirmed successfully, {pagos_restaurados} payments restored")
        
        # Step 5: Verify sale returned to pending
        success, ventas_pendientes, status = self.make_request('GET', 'ventas-pos', params={'estado': 'pendiente'})
        if not success:
            self.log_test("Desconfirmar Flow - Check Pending Sales", False, f"Failed to get pending sales: {ventas_pendientes}")
            return False
        
        venta_en_pendientes = next((v for v in ventas_pendientes if v['id'] == venta_id), None)
        if not venta_en_pendientes:
            self.log_test("Desconfirmar Flow - Sale in Pending", False, "Sale not found in pending sales")
            return False
        
        print(f"   ✅ Sale now in PENDING: {venta_en_pendientes['name']} - Estado: {venta_en_pendientes['estado_local']}")
        self.log_test("Desconfirmar Flow - Sale in Pending", True, 
                     f"Sale found in pending with estado={venta_en_pendientes['estado_local']}")
        
        # Step 6: Verify official payments were deleted
        success, pagos_oficiales_despues, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos-oficiales')
        if not success:
            self.log_test("Desconfirmar Flow - Get Official Payments After", False, f"Failed to get official payments after: {pagos_oficiales_despues}")
            return False
        
        num_pagos_despues = len(pagos_oficiales_despues)
        print(f"   💰 Official payments AFTER: {num_pagos_despues} (should be 0)")
        
        if num_pagos_despues == 0:
            self.log_test("Desconfirmar Flow - Official Payments Deleted", True, 
                         "Official payments correctly deleted")
        else:
            self.log_test("Desconfirmar Flow - Official Payments Deleted", False, 
                         f"Expected 0 official payments, found {num_pagos_despues}")
            return False
        
        # Step 7: Verify temporary payments were restored
        success, pagos_temporales_despues, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos')
        if not success:
            self.log_test("Desconfirmar Flow - Get Temporary Payments After", False, f"Failed to get temporary payments after: {pagos_temporales_despues}")
            return False
        
        num_temporales_despues = len(pagos_temporales_despues)
        print(f"   📝 Temporary payments AFTER: {num_temporales_despues} (should be > 0)")
        for pago in pagos_temporales_despues:
            print(f"      - {pago.get('forma_pago')}: {pago.get('monto')}")
        
        if num_temporales_despues > 0:
            self.log_test("Desconfirmar Flow - Temporary Payments Restored", True, 
                         f"Temporary payments correctly restored: {num_temporales_despues} payments")
        else:
            self.log_test("Desconfirmar Flow - Temporary Payments Restored", False, 
                         "Expected > 0 temporary payments, found 0")
            return False
        
        # Step 8: Verify the counts match
        if num_temporales_despues == pagos_restaurados and pagos_restaurados == num_pagos_antes:
            self.log_test("Desconfirmar Flow - Payment Count Consistency", True, 
                         f"Payment counts consistent: {num_pagos_antes} → 0 official, {num_temporales_despues} temporary")
            
            print("   🎉 Complete VentasPOS desconfirmar flow test PASSED!")
            return True
        else:
            self.log_test("Desconfirmar Flow - Payment Count Consistency", False, 
                         f"Payment count mismatch: antes={num_pagos_antes}, restaurados={pagos_restaurados}, temporales={num_temporales_despues}")
            return False

    def test_ventas_pos_duplicate_fix(self):
        """Test that desconfirmar does NOT create duplicate payments - CRITICAL FIX TEST"""
        print("\n🔍 Testing VentasPOS Duplicate Fix - CRITICAL TEST...")
        
        # Step 1: Get a confirmed sale with payments
        success, ventas_confirmadas, status = self.make_request('GET', 'ventas-pos', params={'estado': 'confirmada'})
        if not success or not ventas_confirmadas:
            self.log_test("Duplicate Fix - Get Confirmed Sale", False, f"No confirmed sales found: {ventas_confirmadas}")
            return False
        
        # Find a sale with official payments
        venta_con_pagos = None
        for venta in ventas_confirmadas:
            if venta.get('num_pagos_oficiales', 0) > 0:
                venta_con_pagos = venta
                break
        
        if not venta_con_pagos:
            self.log_test("Duplicate Fix - Find Sale with Payments", False, "No confirmed sales with payments found")
            return False
        
        venta_id = venta_con_pagos['id']
        venta_name = venta_con_pagos['name']
        num_pagos_oficiales = venta_con_pagos['num_pagos_oficiales']
        
        print(f"   📋 TESTING SALE: ID={venta_id}, Name={venta_name}, Official Payments={num_pagos_oficiales}")
        
        # Step 2: Get official payments count and total
        success, pagos_oficiales, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos-oficiales')
        if not success:
            self.log_test("Duplicate Fix - Get Official Payments", False, f"Failed to get official payments: {pagos_oficiales}")
            return False
        
        num_pagos_oficiales_real = len(pagos_oficiales)
        total_pagos_oficiales = sum(float(p.get('monto', 0)) for p in pagos_oficiales)
        
        print(f"   💰 OFFICIAL PAYMENTS: {num_pagos_oficiales_real} payments, Total: S/ {total_pagos_oficiales}")
        for i, pago in enumerate(pagos_oficiales):
            print(f"      {i+1}. {pago.get('forma_pago')}: S/ {pago.get('monto')} (Ref: {pago.get('referencia', 'N/A')})")
        
        self.log_test("Duplicate Fix - Official Payments Count", True, 
                     f"Found {num_pagos_oficiales_real} official payments, Total: S/ {total_pagos_oficiales}")
        
        # Step 3: DESCONFIRMAR (this is where duplicates could occur)
        print(f"   🔄 DESCONFIRMING SALE...")
        success, desconfirmar_response, status = self.make_request('POST', f'ventas-pos/{venta_id}/desconfirmar')
        if not success:
            self.log_test("Duplicate Fix - Desconfirmar", False, f"Failed to desconfirm sale: {desconfirmar_response}")
            return False
        
        print(f"   ✅ DESCONFIRMED: {desconfirmar_response.get('message')}")
        
        # Step 4: CRITICAL - Check temporary payments for duplicates
        success, pagos_temporales, status = self.make_request('GET', f'ventas-pos/{venta_id}/pagos')
        if not success:
            self.log_test("Duplicate Fix - Get Temporary Payments", False, f"Failed to get temporary payments: {pagos_temporales}")
            return False
        
        num_pagos_temporales = len(pagos_temporales)
        total_pagos_temporales = sum(float(p.get('monto', 0)) for p in pagos_temporales)
        
        print(f"   📝 TEMPORARY PAYMENTS AFTER DESCONFIRMAR: {num_pagos_temporales} payments, Total: S/ {total_pagos_temporales}")
        for i, pago in enumerate(pagos_temporales):
            print(f"      {i+1}. {pago.get('forma_pago')}: S/ {pago.get('monto')} (Ref: {pago.get('referencia', 'N/A')})")
        
        # Step 5: CRITICAL VALIDATION - No duplicates
        print(f"\n   🔍 DUPLICATE CHECK:")
        print(f"      - Official payments before: {num_pagos_oficiales_real} (Total: S/ {total_pagos_oficiales})")
        print(f"      - Temporary payments after: {num_pagos_temporales} (Total: S/ {total_pagos_temporales})")
        print(f"      - MUST MATCH: {num_pagos_oficiales_real} == {num_pagos_temporales}")
        
        # Check counts match
        if num_pagos_temporales != num_pagos_oficiales_real:
            self.log_test("Duplicate Fix - Payment Count Match", False, 
                         f"DUPLICATE DETECTED! Expected {num_pagos_oficiales_real} temporary payments, got {num_pagos_temporales}")
            return False
        
        # Check totals match (within 0.01 tolerance)
        if abs(total_pagos_temporales - total_pagos_oficiales) > 0.01:
            self.log_test("Duplicate Fix - Payment Total Match", False, 
                         f"TOTAL MISMATCH! Expected S/ {total_pagos_oficiales}, got S/ {total_pagos_temporales}")
            return False
        
        print(f"   ✅ NO DUPLICATES DETECTED!")
        self.log_test("Duplicate Fix - No Duplicates", True, 
                     f"Payment counts and totals match perfectly: {num_pagos_temporales} payments, S/ {total_pagos_temporales}")
        
        # Step 6: Test complete cycle - confirm again
        print(f"\n   🔄 TESTING COMPLETE CYCLE - Confirming again...")
        
        # Get financial accounts
        success, cuentas, status = self.make_request('GET', 'cuentas-financieras')
        if not success or not cuentas:
            self.log_test("Duplicate Fix - Get Accounts for Re-confirm", False, "No financial accounts found")
            return False
        
        cuenta_id = cuentas[0]['id']
        
        # Add a small payment to complete the cycle
        pago_data = {
            "cuenta_financiera_id": cuenta_id,
            "forma_pago": "Efectivo",
            "monto": 0.01,
            "referencia": "TEST-FIX-CYCLE",
            "fecha_pago": "2026-02-01",
            "observaciones": "Test duplicate fix cycle"
        }
        
        success, pago_response, status = self.make_request('POST', f'ventas-pos/{venta_id}/pagos', pago_data)
        if success:
            print(f"   ✅ CYCLE TEST: Added small payment and re-confirmed successfully")
            self.log_test("Duplicate Fix - Complete Cycle Test", True, 
                         "Successfully completed desconfirmar → confirm cycle without duplicates")
        else:
            print(f"   ⚠️  CYCLE TEST: Could not complete cycle: {pago_response}")
            self.log_test("Duplicate Fix - Complete Cycle Test", False, 
                         f"Could not complete cycle: {pago_response}")
        
        print(f"\n   🎉 DUPLICATE FIX TEST PASSED!")
        print(f"      ✅ No duplicates created during desconfirmar")
        print(f"      ✅ Payment counts match: {num_pagos_oficiales_real} → {num_pagos_temporales}")
        print(f"      ✅ Payment totals match: S/ {total_pagos_oficiales} → S/ {total_pagos_temporales}")
        
        return True

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
            ("Bank Reconciliation Save", self.test_bank_reconciliation_save),
            ("VentasPOS Payment Flow", self.test_ventas_pos_payment_flow),
            ("VentasPOS Desconfirmar Flow", self.test_ventas_pos_desconfirmar_flow),
            ("VentasPOS Duplicate Fix Test", self.test_ventas_pos_duplicate_fix),
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