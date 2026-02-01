#!/usr/bin/env python3
"""
Test script to verify that VentasPOS payments are now created as INGRESOS (not EGRESOS)
Following the specific test steps provided in the review request.
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
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"❌ Error reading API URL: {e}")
        return None

def test_payment_ingreso_flow():
    """Test the complete flow to verify payments are created as INGRESOS"""
    
    api_url = get_api_url()
    if not api_url:
        print("❌ Could not get API URL from frontend/.env")
        return False
    
    print(f"🔗 Using API URL: {api_url}/api")
    print("=" * 60)
    
    # Step 1: Get a pending sale
    print("📋 Step 1: Getting pending sale...")
    try:
        response = requests.get(f"{api_url}/api/ventas-pos?estado=pendiente")
        if response.status_code != 200:
            print(f"❌ Failed to get pending sales: {response.status_code}")
            return False
        
        ventas = response.json()
        if not ventas:
            print("❌ No hay ventas pendientes")
            return False
        
        venta = ventas[0]
        venta_id = venta['id']
        venta_name = venta['name']
        amount_total = float(venta['amount_total'])
        
        print(f"✅ Venta pendiente: ID={venta_id}, Name={venta_name}, Total={amount_total}")
        
    except Exception as e:
        print(f"❌ Error getting pending sales: {e}")
        return False
    
    # Step 2: Get financial account
    print("\n💳 Step 2: Getting financial account...")
    try:
        response = requests.get(f"{api_url}/api/cuentas-financieras")
        if response.status_code != 200:
            print(f"❌ Failed to get financial accounts: {response.status_code}")
            return False
        
        cuentas = response.json()
        if not cuentas:
            print("❌ No hay cuentas")
            return False
        
        cuenta = cuentas[0]
        cuenta_id = cuenta['id']
        cuenta_nombre = cuenta['nombre']
        
        print(f"✅ Cuenta: ID={cuenta_id}, Nombre={cuenta_nombre}")
        
    except Exception as e:
        print(f"❌ Error getting financial accounts: {e}")
        return False
    
    # Step 3: Assign payment for auto-confirmation
    print(f"\n💰 Step 3: Assigning payment for auto-confirmation...")
    try:
        pago_data = {
            "cuenta_financiera_id": cuenta_id,
            "forma_pago": "Efectivo",
            "monto": amount_total,
            "referencia": "TEST-INGRESO",
            "fecha_pago": "2026-01-31",
            "observaciones": "Test ingreso"
        }
        
        response = requests.post(
            f"{api_url}/api/ventas-pos/{venta_id}/pagos",
            headers={"Content-Type": "application/json"},
            json=pago_data
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to assign payment: {response.status_code} - {response.text}")
            return False
        
        resp = response.json()
        print(f"✅ Response: {resp}")
        
    except Exception as e:
        print(f"❌ Error assigning payment: {e}")
        return False
    
    # Step 4: CRITICAL - Verify that the payment is of type INGRESO
    print(f"\n🔍 Step 4: CRITICAL - Verifying payment type is INGRESO...")
    try:
        response = requests.get(f"{api_url}/api/ventas-pos/{venta_id}/pagos-oficiales")
        if response.status_code != 200:
            print(f"❌ Failed to get official payments: {response.status_code}")
            return False
        
        pagos = response.json()
        if not pagos:
            print("❌ No se encontró pago")
            return False
        
        pago = pagos[0]
        numero = pago.get('numero', '')
        monto = pago.get('monto', 0)
        
        print(f"✅ Pago creado: Número={numero}, Monto={monto}")
        
        # Check if number starts with PAG-I- (for ingreso)
        if numero.startswith('PAG-I-'):
            print(f"✅ CORRECTO: El número del pago empieza con PAG-I- (ingreso)")
        else:
            print(f"❌ ERROR: El número del pago NO empieza con PAG-I-: {numero}")
            return False
        
    except Exception as e:
        print(f"❌ Error verifying payment type: {e}")
        return False
    
    # Step 5: Verify in cont_pago table directly
    print(f"\n📊 Step 5: Verifying in cont_pago table...")
    try:
        response = requests.get(f"{api_url}/api/pagos?tipo=ingreso")
        if response.status_code != 200:
            print(f"❌ Failed to get pagos ingreso: {response.status_code}")
            return False
        
        pagos = response.json()
        pagos_pos = [p for p in pagos if 'venta POS' in (p.get('notas') or '')]
        
        print(f"✅ Total pagos INGRESO de ventas POS: {len(pagos_pos)}")
        
        if pagos_pos:
            ultimo = pagos_pos[0]  # Most recent
            numero_ultimo = ultimo.get('numero', '')
            monto_ultimo = ultimo.get('monto_total', 0)
            tipo_ultimo = ultimo.get('tipo', '')
            
            print(f"✅ Último pago: {numero_ultimo} - {monto_ultimo} - tipo: {tipo_ultimo}")
            
            # Final verification
            if numero_ultimo.startswith('PAG-I-') and tipo_ultimo == 'ingreso':
                print(f"\n🎉 SUCCESS: Payment correctly created as INGRESO!")
                print(f"   - Número: {numero_ultimo} (starts with PAG-I-)")
                print(f"   - Tipo: {tipo_ultimo}")
                print(f"   - Monto: {monto_ultimo} (positive)")
                return True
            else:
                print(f"\n❌ FAILURE: Payment not correctly created as INGRESO")
                print(f"   - Número: {numero_ultimo} (should start with PAG-I-)")
                print(f"   - Tipo: {tipo_ultimo} (should be 'ingreso')")
                return False
        else:
            print("❌ No hay pagos de ventas POS encontrados")
            return False
        
    except Exception as e:
        print(f"❌ Error verifying cont_pago table: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 Testing VentasPOS Payment Type - INGRESO Verification")
    print("Objetivo: Confirmar que el nuevo pago se crea con tipo='ingreso' y número='PAG-I-YYYY-XXXXX'")
    print("=" * 80)
    
    success = test_payment_ingreso_flow()
    
    print("\n" + "=" * 80)
    if success:
        print("🎉 TEST PASSED: Payments are correctly created as INGRESOS")
        return 0
    else:
        print("❌ TEST FAILED: Payments are NOT correctly created as INGRESOS")
        return 1

if __name__ == "__main__":
    sys.exit(main())