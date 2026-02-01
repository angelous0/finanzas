#!/usr/bin/env python3
"""
Specific test for VentasPOS Desconfirmar Flow
Tests the complete unconfirm functionality as requested
"""

import requests
import json
import sys
from datetime import datetime

def test_desconfirmar_flow():
    """Test the complete desconfirmar flow as specified in the requirements"""
    
    # Get API URL from environment
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                api_url = line.split('=')[1].strip() + '/api'
                break
    
    print("🔍 Testing VentasPOS Desconfirmar Flow")
    print(f"📡 API URL: {api_url}")
    print("=" * 60)
    
    # Step 1: Get a confirmed sale with payments
    print("\n1️⃣ Getting confirmed sale with payments...")
    response = requests.get(f"{api_url}/ventas-pos?estado=confirmada")
    if response.status_code != 200:
        print(f"❌ Failed to get confirmed sales: {response.status_code}")
        return False
    
    ventas = response.json()
    venta_con_pagos = None
    for venta in ventas:
        if venta.get('num_pagos_oficiales', 0) > 0:
            venta_con_pagos = venta
            break
    
    if not venta_con_pagos:
        print("❌ No confirmed sales with payments found")
        return False
    
    venta_id = venta_con_pagos['id']
    venta_name = venta_con_pagos['name']
    num_pagos = venta_con_pagos['num_pagos_oficiales']
    
    print(f"✅ Found confirmed sale: ID={venta_id}, Name={venta_name}, Pagos={num_pagos}")
    
    # Step 2: Verify official payments before unconfirming
    print("\n2️⃣ Verifying official payments before unconfirming...")
    response = requests.get(f"{api_url}/ventas-pos/{venta_id}/pagos-oficiales")
    if response.status_code != 200:
        print(f"❌ Failed to get official payments: {response.status_code}")
        return False
    
    pagos_oficiales_antes = response.json()
    print(f"✅ Official payments BEFORE: {len(pagos_oficiales_antes)}")
    for pago in pagos_oficiales_antes:
        print(f"   - {pago.get('numero')}: {pago.get('monto')} ({pago.get('forma_pago')})")
    
    # Step 3: Verify temporary payments before (may or may not be empty)
    print("\n3️⃣ Checking temporary payments before unconfirming...")
    response = requests.get(f"{api_url}/ventas-pos/{venta_id}/pagos")
    if response.status_code != 200:
        print(f"❌ Failed to get temporary payments: {response.status_code}")
        return False
    
    pagos_temporales_antes = response.json()
    print(f"✅ Temporary payments BEFORE: {len(pagos_temporales_antes)}")
    
    # Step 4: DESCONFIRMAR LA VENTA
    print("\n4️⃣ DESCONFIRMING THE SALE...")
    response = requests.post(f"{api_url}/ventas-pos/{venta_id}/desconfirmar")
    if response.status_code != 200:
        print(f"❌ Failed to unconfirm sale: {response.status_code} - {response.text}")
        return False
    
    desconfirmar_result = response.json()
    print(f"✅ {desconfirmar_result.get('message')}")
    print(f"   - Payments restored: {desconfirmar_result.get('pagos_restaurados')}")
    print(f"   - New state: {desconfirmar_result.get('nuevo_estado')}")
    
    # Step 5: Verify sale returned to pending
    print("\n5️⃣ Verifying sale returned to pending...")
    response = requests.get(f"{api_url}/ventas-pos?estado=pendiente")
    if response.status_code != 200:
        print(f"❌ Failed to get pending sales: {response.status_code}")
        return False
    
    ventas_pendientes = response.json()
    venta_en_pendientes = next((v for v in ventas_pendientes if v['id'] == venta_id), None)
    
    if not venta_en_pendientes:
        print("❌ Sale not found in pending sales")
        return False
    
    print(f"✅ Sale now in PENDING: {venta_en_pendientes['name']} - Estado: {venta_en_pendientes['estado_local']}")
    
    # Step 6: Verify official payments were deleted
    print("\n6️⃣ Verifying official payments were deleted...")
    response = requests.get(f"{api_url}/ventas-pos/{venta_id}/pagos-oficiales")
    if response.status_code != 200:
        print(f"❌ Failed to get official payments after: {response.status_code}")
        return False
    
    pagos_oficiales_despues = response.json()
    print(f"✅ Official payments AFTER: {len(pagos_oficiales_despues)} (should be 0)")
    
    if len(pagos_oficiales_despues) != 0:
        print("❌ Official payments were not properly deleted")
        return False
    
    # Step 7: Verify temporary payments were restored
    print("\n7️⃣ Verifying temporary payments were restored...")
    response = requests.get(f"{api_url}/ventas-pos/{venta_id}/pagos")
    if response.status_code != 200:
        print(f"❌ Failed to get temporary payments after: {response.status_code}")
        return False
    
    pagos_temporales_despues = response.json()
    print(f"✅ Temporary payments AFTER: {len(pagos_temporales_despues)} (should be > 0)")
    for pago in pagos_temporales_despues:
        print(f"   - {pago.get('forma_pago')}: {pago.get('monto')}")
    
    if len(pagos_temporales_despues) == 0:
        print("❌ No temporary payments found after unconfirming")
        return False
    
    # Final verification
    print("\n🎯 FINAL VERIFICATION:")
    print(f"   - Sale state changed: confirmada → pendiente ✅")
    print(f"   - Official payments deleted: {len(pagos_oficiales_antes)} → 0 ✅")
    print(f"   - Temporary payments restored: {len(pagos_temporales_antes)} → {len(pagos_temporales_despues)} ✅")
    print(f"   - User can now reassign payments from Pendientes tab ✅")
    
    print("\n🎉 DESCONFIRMAR FLOW TEST PASSED!")
    print("   The desconfirmar functionality is working correctly:")
    print("   ✅ Deletes official payments from cont_pago tables")
    print("   ✅ Restores payments to cont_venta_pos_pago (temporary table)")
    print("   ✅ Changes sale state back to 'pendiente'")
    print("   ✅ Allows user to reassign payments")
    
    return True

if __name__ == "__main__":
    success = test_desconfirmar_flow()
    sys.exit(0 if success else 1)