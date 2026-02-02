#!/usr/bin/env python3
"""
Specific test for VentasPOS payment confirmation flow
Following the exact steps requested in the review
"""

import requests
import json
import sys
import os

def get_api_url():
    """Get API URL from frontend .env file"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=')[1].strip()
    except:
        pass
    return "https://quickfix-finanzas.preview.emergentagent.com"

def test_ventas_pos_complete_flow():
    """Test complete VentasPOS payment assignment and auto-confirmation flow"""
    
    API_URL = get_api_url()
    print(f"🔗 Using API URL: {API_URL}")
    
    # Step 1: Obtener una venta pendiente
    print("\n📋 Step 1: Obtener una venta pendiente")
    try:
        response = requests.get(f"{API_URL}/api/ventas-pos?estado=pendiente")
        ventas = response.json()
        
        if not ventas:
            print("❌ No hay ventas pendientes")
            return False
            
        venta = ventas[0]
        print(f"✅ Venta pendiente: ID={venta['id']}, Name={venta['name']}, Total={venta['amount_total']}")
        
        VENTA_ID = venta['id']
        MONTO = venta['amount_total']
        
    except Exception as e:
        print(f"❌ Error getting pending sales: {e}")
        return False
    
    # Step 2: Obtener cuentas financieras disponibles
    print("\n💳 Step 2: Obtener cuentas financieras disponibles")
    try:
        response = requests.get(f"{API_URL}/api/cuentas-financieras")
        cuentas = response.json()
        
        if not cuentas:
            print("❌ No hay cuentas financieras")
            return False
            
        cuenta = cuentas[0]
        print(f"✅ Cuenta ID: {cuenta['id']}, Nombre: {cuenta['nombre']}")
        
        CUENTA_ID = cuenta['id']
        
    except Exception as e:
        print(f"❌ Error getting financial accounts: {e}")
        return False
    
    # Step 3: Asignar un pago a la venta (debe auto-confirmar si el monto = total)
    print("\n💰 Step 3: Asignar un pago a la venta")
    try:
        pago_data = {
            "cuenta_financiera_id": CUENTA_ID,
            "forma_pago": "Efectivo",
            "monto": MONTO,
            "referencia": "TEST-PAGO-AUTO",
            "fecha_pago": "2026-01-30",
            "observaciones": "Pago de prueba automático"
        }
        
        response = requests.post(f"{API_URL}/api/ventas-pos/{VENTA_ID}/pagos", 
                               json=pago_data,
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code != 200:
            print(f"❌ Error assigning payment: {response.status_code} - {response.text}")
            return False
            
        resp = response.json()
        print(f"✅ Response: {resp}")
        
        if not resp.get('auto_confirmed'):
            print(f"❌ Payment was not auto-confirmed: {resp}")
            return False
            
        print(f"✅ Pago agregado y venta confirmada automáticamente")
        
    except Exception as e:
        print(f"❌ Error assigning payment: {e}")
        return False
    
    # Step 4: Verificar que la venta está confirmada
    print("\n✅ Step 4: Verificar que la venta está confirmada")
    try:
        response = requests.get(f"{API_URL}/api/ventas-pos?estado=confirmada")
        ventas_confirmadas = response.json()
        
        venta_confirmada = next((v for v in ventas_confirmadas if v['id'] == VENTA_ID), None)
        
        if not venta_confirmada:
            print("❌ Venta NO encontrada en confirmadas")
            return False
            
        print(f"✅ Venta confirmada: {venta_confirmada['name']} - Estado: {venta_confirmada.get('estado_local')}")
        
    except Exception as e:
        print(f"❌ Error checking confirmed sales: {e}")
        return False
    
    # Step 5: Verificar pagos oficiales creados
    print("\n🏦 Step 5: Verificar pagos oficiales creados")
    try:
        response = requests.get(f"{API_URL}/api/ventas-pos/{VENTA_ID}/pagos-oficiales")
        pagos_oficiales = response.json()
        
        print(f"✅ Pagos oficiales encontrados: {len(pagos_oficiales)}")
        
        for pago in pagos_oficiales:
            print(f"  - Pago: numero={pago.get('numero')}, monto={pago.get('monto')}, forma_pago={pago.get('forma_pago')}")
        
        if len(pagos_oficiales) == 0:
            print("❌ No se encontraron pagos oficiales")
            return False
            
    except Exception as e:
        print(f"❌ Error getting official payments: {e}")
        return False
    
    # Step 6: Verificar campos pagos_oficiales y num_pagos_oficiales en la venta
    print("\n📊 Step 6: Verificar campos pagos_oficiales y num_pagos_oficiales")
    try:
        # Get the sale from confirmed sales list to see calculated fields
        response = requests.get(f"{API_URL}/api/ventas-pos?estado=confirmada")
        ventas_confirmadas = response.json()
        
        venta_detail = next((v for v in ventas_confirmadas if v['id'] == VENTA_ID), None)
        
        if not venta_detail:
            print("❌ No se pudo obtener detalles de la venta")
            return False
            
        pagos_oficiales_amount = venta_detail.get('pagos_oficiales', 0)
        num_pagos_oficiales = venta_detail.get('num_pagos_oficiales', 0)
        
        print(f"✅ pagos_oficiales: {pagos_oficiales_amount}, num_pagos_oficiales: {num_pagos_oficiales}")
        
        # Verify expected results
        if abs(float(pagos_oficiales_amount) - float(MONTO)) < 0.01 and num_pagos_oficiales == 1:
            print(f"✅ RESULTADO ESPERADO CUMPLIDO:")
            print(f"  - La venta está confirmada ✅")
            print(f"  - Hay 1 pago oficial ✅")
            print(f"  - pagos_oficiales ({pagos_oficiales_amount}) = monto del pago ({MONTO}) ✅")
            print(f"  - num_pagos_oficiales = 1 ✅")
            return True
        else:
            print(f"❌ RESULTADO NO CUMPLE EXPECTATIVAS:")
            print(f"  - pagos_oficiales: {pagos_oficiales_amount} (esperado: {MONTO})")
            print(f"  - num_pagos_oficiales: {num_pagos_oficiales} (esperado: 1)")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying sale fields: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing VentasPOS Complete Payment Assignment and Auto-Confirmation Flow")
    print("=" * 80)
    
    success = test_ventas_pos_complete_flow()
    
    print("\n" + "=" * 80)
    if success:
        print("🎉 TODAS LAS PRUEBAS PASARON - El flujo completo funciona correctamente!")
        return 0
    else:
        print("❌ ALGUNAS PRUEBAS FALLARON - Revisar errores arriba")
        return 1

if __name__ == "__main__":
    sys.exit(main())