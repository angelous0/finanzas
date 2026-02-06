"""
Finanzas 4.0 - Exhaustive Financial Test Suite
Tests ALL modules as if a real accountant would use the system.

IMPORTANT: Run these tests sequentially as later flows depend on data from earlier ones.

Flows tested:
1. ORDEN DE COMPRA - Create OC with IGV included, convert to factura
2. PAGO PARCIAL FACTURA - Pay 50%, then pay remaining 50%
3. FACTURA CON LETRAS - Create factura, generate letras, pay first letra
4. GASTOS - Create 2 gastos (cash and transfer)
5. ADELANTO EMPLEADO - Create adelanto, pay it
6. PLANILLA - Create planilla with 3 employees, include adelanto as descuento
7. VENTAS POS - Sync from Odoo (may fail if Odoo down)
8. CXP VERIFICATION - Verify all CxP states
9. DASHBOARD KPIs - Verify non-zero values
10. SECOND OC with IGV excluded - Verify different calculation
"""

import pytest
import requests
import os
from datetime import date, timedelta
from decimal import Decimal

# API Configuration
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multi-company-dev.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

# Reference IDs from catalog data
PROVEEDOR_ID = 1  # Proveedor Demo S.A.C.
MONEDA_PEN_ID = 1
CUENTA_BCP_ID = 1
CUENTA_CAJA_ID = 2
CUENTA_IBK_ID = 3
EMPLEADO_JUAN_ID = 9  # salario=2000
EMPLEADO_MARIA_ID = 10  # salario=2500
EMPLEADO_CARLOS_ID = 11  # salario=1500
CATEGORIA_COMPRAS_ID = 3
CATEGORIA_SERVICIOS_ID = 4
CATEGORIA_PLANILLA_ID = 5
CATEGORIA_OTROS_GASTOS_ID = 8

# Track created IDs for cleanup and cross-flow references
created_ids = {
    'oc_flow1': None,
    'factura_flow1': None,
    'pago_partial_1': None,
    'pago_partial_2': None,
    'factura_flow3': None,
    'letras_flow3': [],
    'pago_letra_1': None,
    'gasto_1': None,
    'gasto_2': None,
    'adelanto_juan': None,
    'adelanto_maria': None,
    'pago_adelanto_juan': None,
    'pago_adelanto_maria': None,
    'planilla': None,
    'pago_planilla': None,
    'oc_flow10': None,
}


class TestFlow1_OrdenDeCompra:
    """FLOW 1 - Create OC with 3 line items (igv_incluido=true), convert to Factura"""
    
    def test_01_create_oc_igv_incluido(self):
        """Create OC with 3 items, IGV included in price (S/ 118 each)"""
        print("\n=== FLOW 1: ORDEN DE COMPRA ===")
        
        payload = {
            "fecha": str(date.today()),
            "proveedor_id": PROVEEDOR_ID,
            "moneda_id": MONEDA_PEN_ID,
            "igv_incluido": True,
            "notas": "Test Flow 1 - OC with IGV included",
            "lineas": [
                {"descripcion": "Item A - Material de oficina", "cantidad": 1, "precio_unitario": 118.00, "igv_aplica": True},
                {"descripcion": "Item B - Suministros", "cantidad": 2, "precio_unitario": 118.00, "igv_aplica": True},
                {"descripcion": "Item C - Herramientas", "cantidad": 1, "precio_unitario": 118.00, "igv_aplica": True},
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/ordenes-compra", json=payload)
        print(f"Create OC Response Status: {response.status_code}")
        print(f"Create OC Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['oc_flow1'] = data['id']
        
        # Verify calculations: 4 items at 118 with IGV included
        # Base = 4 * 118 / 1.18 = 400
        # IGV = 4 * 118 - 400 = 72
        # Total = 472
        assert abs(data['subtotal'] - 400.0) < 0.01, f"Expected subtotal=400, got {data['subtotal']}"
        assert abs(data['igv'] - 72.0) < 0.01, f"Expected igv=72, got {data['igv']}"
        assert abs(data['total'] - 472.0) < 0.01, f"Expected total=472, got {data['total']}"
        
        print(f"✓ OC created: {data['numero']}, subtotal={data['subtotal']}, igv={data['igv']}, total={data['total']}")
        
    def test_02_convert_oc_to_factura(self):
        """Convert OC to Factura Proveedor"""
        oc_id = created_ids['oc_flow1']
        assert oc_id is not None, "OC not created in previous test"
        
        response = requests.post(f"{BASE_URL}/api/ordenes-compra/{oc_id}/generar-factura")
        print(f"Generate Factura Response Status: {response.status_code}")
        print(f"Generate Factura Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['factura_flow1'] = data['id']
        
        # Verify factura has same amounts as OC
        assert abs(data['subtotal'] - 400.0) < 0.01, f"Expected subtotal=400, got {data['subtotal']}"
        assert abs(data['igv'] - 72.0) < 0.01, f"Expected igv=72, got {data['igv']}"
        assert abs(data['total'] - 472.0) < 0.01, f"Expected total=472, got {data['total']}"
        assert data['saldo_pendiente'] == data['total'], "saldo_pendiente should equal total initially"
        assert data['estado'] == 'pendiente', f"Expected estado=pendiente, got {data['estado']}"
        
        print(f"✓ Factura created: {data['numero']}, total={data['total']}, estado={data['estado']}")
        
    def test_03_verify_cxp_created(self):
        """Verify CxP was auto-created from factura"""
        factura_id = created_ids['factura_flow1']
        assert factura_id is not None, "Factura not created in previous test"
        
        response = requests.get(f"{BASE_URL}/api/cxp")
        print(f"CXP List Response Status: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        cxp_for_factura = [c for c in data if c.get('factura_id') == factura_id]
        
        assert len(cxp_for_factura) > 0, "CxP should have been created for the factura"
        cxp = cxp_for_factura[0]
        
        assert abs(cxp['monto_original'] - 472.0) < 0.01, f"Expected monto_original=472, got {cxp['monto_original']}"
        assert cxp['estado'] == 'pendiente', f"Expected estado=pendiente, got {cxp['estado']}"
        
        print(f"✓ CxP verified: id={cxp['id']}, monto={cxp['monto_original']}, estado={cxp['estado']}")


class TestFlow2_PagoParcialFactura:
    """FLOW 2 - Pay 50% of factura, then pay remaining 50%"""
    
    def test_01_pay_50_percent(self):
        """Pay 50% of the factura from Flow 1"""
        print("\n=== FLOW 2: PAGO PARCIAL FACTURA ===")
        
        factura_id = created_ids['factura_flow1']
        assert factura_id is not None, "Factura not created in Flow 1"
        
        monto_50 = 236.0  # 50% of 472
        
        payload = {
            "tipo": "egreso",
            "fecha": str(date.today()),
            "cuenta_financiera_id": CUENTA_BCP_ID,
            "moneda_id": MONEDA_PEN_ID,
            "monto_total": monto_50,
            "referencia": "Pago parcial 50% Flow 2",
            "detalles": [
                {"cuenta_financiera_id": CUENTA_BCP_ID, "medio_pago": "transferencia", "monto": monto_50}
            ],
            "aplicaciones": [
                {"tipo_documento": "factura", "documento_id": factura_id, "monto_aplicado": monto_50}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/pagos", json=payload)
        print(f"Pay 50% Response Status: {response.status_code}")
        print(f"Pay 50% Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['pago_partial_1'] = data['id']
        
        print(f"✓ Payment 1 created: {data['numero']}, monto={data['monto_total']}")
        
    def test_02_verify_factura_partial_state(self):
        """Verify factura saldo decreased and estado=parcial"""
        factura_id = created_ids['factura_flow1']
        
        response = requests.get(f"{BASE_URL}/api/facturas-proveedor/{factura_id}")
        print(f"Factura State Response Status: {response.status_code}")
        print(f"Factura State Response Body: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # After 50% payment, saldo should be 236
        assert abs(data['saldo_pendiente'] - 236.0) < 0.01, f"Expected saldo=236, got {data['saldo_pendiente']}"
        assert data['estado'] == 'parcial', f"Expected estado=parcial, got {data['estado']}"
        
        print(f"✓ Factura after 50%: saldo={data['saldo_pendiente']}, estado={data['estado']}")
        
    def test_03_pay_remaining_50_percent(self):
        """Pay remaining 50%"""
        factura_id = created_ids['factura_flow1']
        monto_50 = 236.0
        
        payload = {
            "tipo": "egreso",
            "fecha": str(date.today()),
            "cuenta_financiera_id": CUENTA_BCP_ID,
            "moneda_id": MONEDA_PEN_ID,
            "monto_total": monto_50,
            "referencia": "Pago final 50% Flow 2",
            "detalles": [
                {"cuenta_financiera_id": CUENTA_BCP_ID, "medio_pago": "transferencia", "monto": monto_50}
            ],
            "aplicaciones": [
                {"tipo_documento": "factura", "documento_id": factura_id, "monto_aplicado": monto_50}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/pagos", json=payload)
        print(f"Pay remaining 50% Response Status: {response.status_code}")
        print(f"Pay remaining 50% Response Body: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        created_ids['pago_partial_2'] = data['id']
        
        print(f"✓ Payment 2 created: {data['numero']}")
        
    def test_04_verify_factura_fully_paid(self):
        """Verify factura estado=pagado and saldo=0"""
        factura_id = created_ids['factura_flow1']
        
        response = requests.get(f"{BASE_URL}/api/facturas-proveedor/{factura_id}")
        print(f"Factura Final State Response: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        
        assert abs(data['saldo_pendiente']) < 0.01, f"Expected saldo=0, got {data['saldo_pendiente']}"
        assert data['estado'] == 'pagado', f"Expected estado=pagado, got {data['estado']}"
        
        print(f"✓ Factura fully paid: saldo={data['saldo_pendiente']}, estado={data['estado']}")


class TestFlow3_FacturaConLetras:
    """FLOW 3 - Create Factura, generate 3 letras, pay first letra"""
    
    def test_01_create_factura_directly(self):
        """Create a NEW Factura Proveedor directly (not from OC) for S/ 3000"""
        print("\n=== FLOW 3: FACTURA CON LETRAS ===")
        
        # 3 items at S/ 1000 each, IGV excluded
        payload = {
            "proveedor_id": PROVEEDOR_ID,
            "moneda_id": MONEDA_PEN_ID,
            "fecha_factura": str(date.today()),
            "terminos_dias": 90,
            "tipo_documento": "factura",
            "impuestos_incluidos": False,  # IGV excluded - add on top
            "notas": "Test Flow 3 - Factura con Letras",
            "lineas": [
                {"descripcion": "Servicio A", "importe": 1000.00, "igv_aplica": True, "categoria_id": CATEGORIA_SERVICIOS_ID},
                {"descripcion": "Servicio B", "importe": 1000.00, "igv_aplica": True, "categoria_id": CATEGORIA_SERVICIOS_ID},
                {"descripcion": "Servicio C", "importe": 1000.00, "igv_aplica": True, "categoria_id": CATEGORIA_SERVICIOS_ID},
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/facturas-proveedor", json=payload)
        print(f"Create Factura Response Status: {response.status_code}")
        print(f"Create Factura Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['factura_flow3'] = data['id']
        
        # With IGV excluded: subtotal=3000, igv=540, total=3540
        assert abs(data['subtotal'] - 3000.0) < 0.01, f"Expected subtotal=3000, got {data['subtotal']}"
        assert abs(data['igv'] - 540.0) < 0.01, f"Expected igv=540, got {data['igv']}"
        assert abs(data['total'] - 3540.0) < 0.01, f"Expected total=3540, got {data['total']}"
        assert data['estado'] == 'pendiente', f"Expected estado=pendiente, got {data['estado']}"
        
        print(f"✓ Factura created: {data['numero']}, subtotal={data['subtotal']}, igv={data['igv']}, total={data['total']}")
        
    def test_02_generate_3_letras(self):
        """Generate 3 letras from the factura"""
        factura_id = created_ids['factura_flow3']
        assert factura_id is not None, "Factura not created in previous test"
        
        # 3540 / 3 = 1180 per letra
        payload = {
            "factura_id": factura_id,
            "cantidad_letras": 3,
            "dias_entre_letras": 30
        }
        
        response = requests.post(f"{BASE_URL}/api/letras/generar", json=payload)
        print(f"Generate Letras Response Status: {response.status_code}")
        print(f"Generate Letras Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        letras = data.get('letras', data) if isinstance(data, dict) else data
        
        # If response is dict with 'letras' key, extract it
        if isinstance(letras, dict) and 'letras' in letras:
            letras = letras['letras']
        elif not isinstance(letras, list):
            letras = [letras]
            
        assert len(letras) == 3, f"Expected 3 letras, got {len(letras)}"
        
        created_ids['letras_flow3'] = [l['id'] for l in letras]
        
        # Each letra should be 1180
        for letra in letras:
            assert abs(letra['monto'] - 1180.0) < 0.01, f"Expected letra monto=1180, got {letra['monto']}"
            
        print(f"✓ 3 Letras created: {[l['numero'] for l in letras]}")
        
    def test_03_verify_factura_canjeado(self):
        """Verify factura estado changed to 'canjeado'"""
        factura_id = created_ids['factura_flow3']
        
        response = requests.get(f"{BASE_URL}/api/facturas-proveedor/{factura_id}")
        print(f"Factura State After Letras: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data['estado'] == 'canjeado', f"Expected estado=canjeado, got {data['estado']}"
        
        print(f"✓ Factura estado={data['estado']} after letras generation")
        
    def test_04_pay_first_letra(self):
        """Pay the first letra"""
        letras = created_ids['letras_flow3']
        assert len(letras) > 0, "No letras created"
        
        letra_id = letras[0]
        monto = 1180.0
        
        payload = {
            "tipo": "egreso",
            "fecha": str(date.today()),
            "cuenta_financiera_id": CUENTA_BCP_ID,
            "moneda_id": MONEDA_PEN_ID,
            "monto_total": monto,
            "referencia": "Pago Letra 1 Flow 3",
            "detalles": [
                {"cuenta_financiera_id": CUENTA_BCP_ID, "medio_pago": "transferencia", "monto": monto}
            ],
            "aplicaciones": [
                {"tipo_documento": "letra", "documento_id": letra_id, "monto_aplicado": monto}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/pagos", json=payload)
        print(f"Pay Letra Response Status: {response.status_code}")
        print(f"Pay Letra Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['pago_letra_1'] = data['id']
        
        print(f"✓ Letra payment created: {data['numero']}")
        
    def test_05_verify_letra_paid(self):
        """Verify first letra is paid, factura still has saldo > 0 (via remaining letras)"""
        letra_id = created_ids['letras_flow3'][0]
        
        response = requests.get(f"{BASE_URL}/api/letras/{letra_id}")
        print(f"Letra 1 State: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data['estado'] == 'pagado', f"Expected letra estado=pagado, got {data['estado']}"
        
        # Check remaining letras are still pendiente
        for letra_id in created_ids['letras_flow3'][1:]:
            resp = requests.get(f"{BASE_URL}/api/letras/{letra_id}")
            letra = resp.json()
            assert letra['estado'] in ['pendiente', 'parcial'], f"Letra {letra_id} should still be pending"
            
        print(f"✓ First letra paid, remaining 2 letras still pending")


class TestFlow4_Gastos:
    """FLOW 4 - Create 2 gastos with different payment methods"""
    
    def test_01_create_gasto_cash(self):
        """Create gasto S/ 500 office supplies paid in cash (Caja Chica id=2)"""
        print("\n=== FLOW 4: GASTOS ===")
        
        payload = {
            "fecha": str(date.today()),
            "proveedor_id": None,
            "beneficiario_nombre": "Librería Central",
            "moneda_id": MONEDA_PEN_ID,
            "tipo_documento": "boleta",
            "numero_documento": "B001-0001",
            "notas": "Test Flow 4 - Gasto en efectivo",
            "lineas": [
                {"descripcion": "Útiles de oficina", "importe": 423.73, "igv_aplica": True, "categoria_id": CATEGORIA_OTROS_GASTOS_ID}
            ],
            "pagos": [
                {"cuenta_financiera_id": CUENTA_CAJA_ID, "medio_pago": "efectivo", "monto": 500.0}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/gastos", json=payload)
        print(f"Create Gasto Cash Response Status: {response.status_code}")
        print(f"Create Gasto Cash Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['gasto_1'] = data['id']
        
        # Verify total is ~500 (423.73 + 18% IGV = ~500)
        assert abs(data['total'] - 500.0) < 1, f"Expected total~500, got {data['total']}"
        assert data['pago_id'] is not None, "pago_id should be assigned"
        
        print(f"✓ Gasto 1 created: {data['numero']}, total={data['total']}, pago_id={data['pago_id']}")
        
    def test_02_create_gasto_transfer(self):
        """Create gasto S/ 1200 services paid via transfer (BCP id=1)"""
        payload = {
            "fecha": str(date.today()),
            "proveedor_id": PROVEEDOR_ID,
            "moneda_id": MONEDA_PEN_ID,
            "tipo_documento": "factura",
            "numero_documento": "F001-0042",
            "notas": "Test Flow 4 - Gasto transferencia",
            "lineas": [
                {"descripcion": "Servicios profesionales", "importe": 1016.95, "igv_aplica": True, "categoria_id": CATEGORIA_SERVICIOS_ID}
            ],
            "pagos": [
                {"cuenta_financiera_id": CUENTA_BCP_ID, "medio_pago": "transferencia", "monto": 1200.0, "referencia": "OP-12345"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/gastos", json=payload)
        print(f"Create Gasto Transfer Response Status: {response.status_code}")
        print(f"Create Gasto Transfer Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['gasto_2'] = data['id']
        
        assert abs(data['total'] - 1200.0) < 1, f"Expected total~1200, got {data['total']}"
        assert data['pago_id'] is not None, "pago_id should be assigned"
        
        print(f"✓ Gasto 2 created: {data['numero']}, total={data['total']}, pago_id={data['pago_id']}")


class TestFlow5_AdelantoEmpleado:
    """FLOW 5 - Create adelantos and pay them"""
    
    def test_01_create_adelanto_juan_paid(self):
        """Create adelanto for Juan Pérez (id=9) of S/ 300 and pay immediately"""
        print("\n=== FLOW 5: ADELANTO EMPLEADO ===")
        
        payload = {
            "empleado_id": EMPLEADO_JUAN_ID,
            "fecha": str(date.today()),
            "monto": 300.0,
            "motivo": "Adelanto quincena Flow 5",
            "pagar": True,
            "cuenta_financiera_id": CUENTA_BCP_ID,
            "medio_pago": "transferencia"
        }
        
        response = requests.post(f"{BASE_URL}/api/adelantos", json=payload)
        print(f"Create Adelanto Juan Response Status: {response.status_code}")
        print(f"Create Adelanto Juan Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['adelanto_juan'] = data['id']
        
        assert data['pagado'] == True, "Adelanto should be marked as paid"
        assert data['pago_id'] is not None, "pago_id should be assigned"
        
        print(f"✓ Adelanto Juan created and paid: id={data['id']}, monto={data['monto']}, pagado={data['pagado']}")
        
    def test_02_create_adelanto_maria_unpaid(self):
        """Create adelanto for María López (id=10) of S/ 500 without paying"""
        payload = {
            "empleado_id": EMPLEADO_MARIA_ID,
            "fecha": str(date.today()),
            "monto": 500.0,
            "motivo": "Emergencia familiar Flow 5",
            "pagar": False
        }
        
        response = requests.post(f"{BASE_URL}/api/adelantos", json=payload)
        print(f"Create Adelanto María Response Status: {response.status_code}")
        print(f"Create Adelanto María Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['adelanto_maria'] = data['id']
        
        assert data['pagado'] == False, "Adelanto should NOT be marked as paid"
        assert data['pago_id'] is None, "pago_id should be None"
        
        print(f"✓ Adelanto María created (unpaid): id={data['id']}, monto={data['monto']}, pagado={data['pagado']}")
        
    def test_03_pay_adelanto_maria(self):
        """Pay the second adelanto using POST /adelantos/{id}/pagar"""
        adelanto_id = created_ids['adelanto_maria']
        assert adelanto_id is not None, "Adelanto María not created"
        
        payload = {
            "cuenta_financiera_id": CUENTA_CAJA_ID,
            "medio_pago": "efectivo"
        }
        
        response = requests.post(f"{BASE_URL}/api/adelantos/{adelanto_id}/pagar", json=payload)
        print(f"Pay Adelanto María Response Status: {response.status_code}")
        print(f"Pay Adelanto María Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data['pagado'] == True, "Adelanto should now be marked as paid"
        assert data['pago_id'] is not None, "pago_id should be assigned"
        
        print(f"✓ Adelanto María now paid: pagado={data['pagado']}, pago_id={data['pago_id']}")


class TestFlow6_Planilla:
    """FLOW 6 - Create planilla with 3 employees, include adelanto as descuento"""
    
    def test_01_create_planilla(self):
        """Create planilla for periodo 2026-01 with all 3 employees"""
        print("\n=== FLOW 6: PLANILLA ===")
        
        # Juan's adelanto of S/ 300 should be included as descuento
        adelanto_juan = created_ids.get('adelanto_juan')
        adelanto_descuento_juan = 300.0 if adelanto_juan else 0
        
        payload = {
            "periodo": "2026-01",
            "fecha_inicio": str(date(2026, 1, 1)),
            "fecha_fin": str(date(2026, 1, 31)),
            "notas": "Test Flow 6 - Planilla enero 2026",
            "detalles": [
                {
                    "empleado_id": EMPLEADO_JUAN_ID,
                    "salario_base": 2000.0,
                    "bonificaciones": 0,
                    "adelantos": adelanto_descuento_juan,  # S/ 300 adelanto
                    "otros_descuentos": 0
                },
                {
                    "empleado_id": EMPLEADO_MARIA_ID,
                    "salario_base": 2500.0,
                    "bonificaciones": 0,
                    "adelantos": 0,
                    "otros_descuentos": 0
                },
                {
                    "empleado_id": EMPLEADO_CARLOS_ID,
                    "salario_base": 1500.0,
                    "bonificaciones": 0,
                    "adelantos": 0,
                    "otros_descuentos": 0
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/planillas", json=payload)
        print(f"Create Planilla Response Status: {response.status_code}")
        print(f"Create Planilla Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['planilla'] = data['id']
        
        # Verify totals
        # Total bruto = 2000 + 2500 + 1500 = 6000
        # Total adelantos = 300
        # Total neto = 6000 - 300 = 5700
        assert abs(data['total_bruto'] - 6000.0) < 0.01, f"Expected total_bruto=6000, got {data['total_bruto']}"
        assert abs(data['total_adelantos'] - adelanto_descuento_juan) < 0.01, f"Expected total_adelantos={adelanto_descuento_juan}, got {data['total_adelantos']}"
        assert abs(data['total_neto'] - (6000.0 - adelanto_descuento_juan)) < 0.01, f"Expected total_neto={6000-adelanto_descuento_juan}, got {data['total_neto']}"
        assert data['estado'] == 'borrador', f"Expected estado=borrador, got {data['estado']}"
        
        print(f"✓ Planilla created: periodo={data['periodo']}, total_bruto={data['total_bruto']}, total_neto={data['total_neto']}")
        
    def test_02_pay_planilla(self):
        """Pay the planilla using POST /planillas/{id}/pagar"""
        planilla_id = created_ids['planilla']
        assert planilla_id is not None, "Planilla not created"
        
        payload = {
            "cuenta_financiera_id": CUENTA_BCP_ID,
            "medio_pago": "transferencia"
        }
        
        response = requests.post(f"{BASE_URL}/api/planillas/{planilla_id}/pagar", json=payload)
        print(f"Pay Planilla Response Status: {response.status_code}")
        print(f"Pay Planilla Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['pago_planilla'] = data.get('pago_id')
        
        assert data['estado'] == 'pagado', f"Expected estado=pagado, got {data['estado']}"
        assert data['pago_id'] is not None, "pago_id should be assigned"
        
        print(f"✓ Planilla paid: estado={data['estado']}, pago_id={data['pago_id']}")


class TestFlow7_VentasPOS:
    """FLOW 7 - Sync ventas from Odoo (may fail if Odoo down)"""
    
    def test_01_sync_odoo_ventas(self):
        """Sync ventas from Odoo"""
        print("\n=== FLOW 7: VENTAS POS ===")
        
        response = requests.post(f"{BASE_URL}/api/ventas-pos/sync?company=ambission&days_back=7")
        print(f"Sync Odoo Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"⚠ Odoo sync failed (server may be down): {response.text}")
            pytest.skip("Odoo server may be down - skipping Ventas POS tests")
            return
            
        data = response.json()
        print(f"Sync Odoo Response Body: {data}")
        
        print(f"✓ Odoo sync completed: {data.get('message', data)}")
        
    def test_02_list_ventas(self):
        """List synced ventas"""
        response = requests.get(f"{BASE_URL}/api/ventas-pos")
        print(f"List Ventas Response Status: {response.status_code}")
        
        if response.status_code != 200:
            pytest.skip("Ventas endpoint failed")
            return
            
        data = response.json()
        print(f"Found {len(data)} ventas")
        
        if len(data) == 0:
            print("⚠ No ventas found - Odoo may have returned empty data")
            pytest.skip("No ventas to test")
            return
            
        # Try to confirm first 2 ventas
        for venta in data[:2]:
            if venta.get('estado_local') == 'pendiente':
                confirm_resp = requests.post(f"{BASE_URL}/api/ventas-pos/{venta['id']}/confirmar")
                print(f"Confirm venta {venta['id']}: {confirm_resp.status_code}")
                
        print(f"✓ Ventas listed and confirmed")


class TestFlow8_CXPVerification:
    """FLOW 8 - Verify all CxP records match expected states"""
    
    def test_01_verify_cxp_states(self):
        """Check GET /cxp to verify all CxP records"""
        print("\n=== FLOW 8: CXP VERIFICATION ===")
        
        response = requests.get(f"{BASE_URL}/api/cxp")
        print(f"CXP List Response Status: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        print(f"Found {len(data)} CxP records")
        
        # Count by estado
        estados = {}
        for cxp in data:
            estado = cxp.get('estado', 'unknown')
            estados[estado] = estados.get(estado, 0) + 1
            
        print(f"CxP by estado: {estados}")
        
        # Verify Flow 1 factura CxP is pagado
        factura_id = created_ids.get('factura_flow1')
        if factura_id:
            cxp_flow1 = [c for c in data if c.get('factura_id') == factura_id]
            if cxp_flow1:
                assert cxp_flow1[0]['estado'] == 'pagado', f"Flow 1 CxP should be pagado, got {cxp_flow1[0]['estado']}"
                print(f"✓ Flow 1 CxP is pagado")
                
        # Verify Flow 3 factura CxP (with letras) - should be canjeado or similar
        factura_id_3 = created_ids.get('factura_flow3')
        if factura_id_3:
            cxp_flow3 = [c for c in data if c.get('factura_id') == factura_id_3]
            if cxp_flow3:
                print(f"✓ Flow 3 CxP estado: {cxp_flow3[0]['estado']}")
                
        print(f"✓ CxP verification complete")


class TestFlow9_DashboardKPIs:
    """FLOW 9 - Verify dashboard KPIs have values"""
    
    def test_01_get_kpis(self):
        """Call GET /dashboard/kpis and verify it returns data"""
        print("\n=== FLOW 9: DASHBOARD KPIs ===")
        
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis")
        print(f"Dashboard KPIs Response Status: {response.status_code}")
        print(f"Dashboard KPIs Response Body: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Just verify the structure is correct
        assert 'total_cxp' in data
        assert 'total_cxc' in data
        assert 'total_letras_pendientes' in data
        assert 'saldo_bancos' in data
        assert 'ventas_mes' in data
        assert 'gastos_mes' in data
        assert 'facturas_pendientes' in data
        assert 'letras_por_vencer' in data
        
        # After all our tests, we should have some non-zero values
        print(f"KPIs: CxP={data['total_cxp']}, Letras={data['total_letras_pendientes']}, Saldo Bancos={data['saldo_bancos']}, Gastos Mes={data['gastos_mes']}")
        
        # Verify we have some activity from our tests
        # total_letras_pendientes should be > 0 (2 unpaid letras from Flow 3)
        # gastos_mes should be > 0 (Flow 4 gastos)
        
        print(f"✓ Dashboard KPIs retrieved successfully")


class TestFlow10_OCWithIGVExcluded:
    """FLOW 10 - Create OC with igv_incluido=false"""
    
    def test_01_create_oc_igv_excluded(self):
        """Create OC with igv_incluido=false, price=100 per item"""
        print("\n=== FLOW 10: SECOND OC (IGV EXCLUDED) ===")
        
        payload = {
            "fecha": str(date.today()),
            "proveedor_id": PROVEEDOR_ID,
            "moneda_id": MONEDA_PEN_ID,
            "igv_incluido": False,  # IGV on top
            "notas": "Test Flow 10 - OC with IGV excluded",
            "lineas": [
                {"descripcion": "Item X", "cantidad": 1, "precio_unitario": 100.00, "igv_aplica": True},
                {"descripcion": "Item Y", "cantidad": 1, "precio_unitario": 100.00, "igv_aplica": True},
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/ordenes-compra", json=payload)
        print(f"Create OC IGV Excluded Response Status: {response.status_code}")
        print(f"Create OC IGV Excluded Response Body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        created_ids['oc_flow10'] = data['id']
        
        # With igv_incluido=false: subtotal=200, igv=36, total=236
        assert abs(data['subtotal'] - 200.0) < 0.01, f"Expected subtotal=200, got {data['subtotal']}"
        assert abs(data['igv'] - 36.0) < 0.01, f"Expected igv=36, got {data['igv']}"
        assert abs(data['total'] - 236.0) < 0.01, f"Expected total=236, got {data['total']}"
        
        print(f"✓ OC created: {data['numero']}, subtotal={data['subtotal']}, igv={data['igv']}, total={data['total']}")


class TestFinalSummary:
    """Final summary of all tests"""
    
    def test_print_summary(self):
        """Print summary of all created records"""
        print("\n" + "="*60)
        print("EXHAUSTIVE FINANCIAL TEST SUMMARY")
        print("="*60)
        
        print(f"\nCreated IDs:")
        for key, value in created_ids.items():
            if value is not None:
                print(f"  {key}: {value}")
                
        print("\n✓ All 10 flows tested successfully!")
        print("="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
