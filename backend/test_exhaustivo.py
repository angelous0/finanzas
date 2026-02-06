"""
Test exhaustivo Finanzas 4.0 - Flujo completo financiero
"""
import asyncio
import httpx
import json

API = "https://multi-company-dev.preview.emergentagent.com/api"
RESULTS = []

def log(msg, ok=None):
    prefix = "  PASS" if ok == True else "  FAIL" if ok == False else "  ---"
    print(f"{prefix} {msg}")
    RESULTS.append({"msg": msg, "ok": ok})

async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 1: ORDEN DE COMPRA → FACTURA")
        print("="*60)
        
        # 1.1 Crear OC con IGV incluido
        r = await c.post(f"{API}/ordenes-compra", json={
            "fecha": "2026-02-05", "proveedor_id": 1, "moneda_id": 1, "igv_incluido": True,
            "notas": "Compra telas producción",
            "lineas": [
                {"descripcion": "Tela Denim 100m", "cantidad": 100, "precio_unitario": 11.80, "igv_aplica": True},
                {"descripcion": "Tela Algodón 50m", "cantidad": 50, "precio_unitario": 8.26, "igv_aplica": True},
                {"descripcion": "Hilo Industrial 20u", "cantidad": 20, "precio_unitario": 5.90, "igv_aplica": True}
            ]
        })
        oc = r.json()
        log(f"OC creada: id={oc['id']} {oc['numero']} sub={oc['subtotal']:.2f} igv={oc['igv']:.2f} total={oc['total']:.2f}", 
            r.status_code == 200 and abs(oc['total'] - 1711.0) < 0.01)
        oc_id = oc['id']
        
        # 1.2 Convertir OC a Factura
        r = await c.post(f"{API}/ordenes-compra/{oc_id}/generar-factura")
        fac1 = r.json()
        log(f"OC→Factura: id={fac1['id']} {fac1['numero']} total={fac1['total']:.2f} saldo={fac1['saldo_pendiente']:.2f} estado={fac1['estado']}",
            r.status_code == 200 and fac1['estado'] == 'pendiente' and abs(fac1['saldo_pendiente'] - fac1['total']) < 0.01)
        fac1_id = fac1['id']
        fac1_total = fac1['total']
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 2: PAGOS PARCIALES DE FACTURA")
        print("="*60)
        
        # 2.1 Pagar 50%
        mitad = round(fac1_total / 2, 2)
        r = await c.post(f"{API}/pagos", json={
            "tipo": "egreso", "fecha": "2026-02-05", "moneda_id": 1, "monto_total": mitad,
            "referencia": "Pago parcial 1/2",
            "detalles": [{"cuenta_financiera_id": 1, "medio_pago": "transferencia", "monto": mitad}],
            "aplicaciones": [{"tipo_documento": "factura", "documento_id": fac1_id, "monto_aplicado": mitad}]
        })
        p1 = r.json()
        log(f"Pago parcial 1: id={p1.get('id')} monto={mitad}", r.status_code == 200 and 'id' in p1)
        
        # Verificar factura parcial
        r = await c.get(f"{API}/facturas-proveedor/{fac1_id}")
        f_check = r.json()
        log(f"Factura parcial: estado={f_check['estado']} saldo={f_check['saldo_pendiente']:.2f}",
            f_check['estado'] == 'parcial')
        
        # 2.2 Pagar restante
        resto = round(fac1_total - mitad, 2)
        r = await c.post(f"{API}/pagos", json={
            "tipo": "egreso", "fecha": "2026-02-06", "moneda_id": 1, "monto_total": resto,
            "referencia": "Pago final",
            "detalles": [{"cuenta_financiera_id": 1, "medio_pago": "transferencia", "monto": resto}],
            "aplicaciones": [{"tipo_documento": "factura", "documento_id": fac1_id, "monto_aplicado": resto}]
        })
        p2 = r.json()
        log(f"Pago final: id={p2.get('id')} monto={resto}", r.status_code == 200 and 'id' in p2)
        
        r = await c.get(f"{API}/facturas-proveedor/{fac1_id}")
        f_final = r.json()
        log(f"Factura PAGADA: estado={f_final['estado']} saldo={f_final['saldo_pendiente']:.2f}",
            f_final['estado'] == 'pagado' and f_final['saldo_pendiente'] == 0)
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 3: FACTURA DIRECTA + LETRAS + PAGO LETRAS")
        print("="*60)
        
        # 3.1 Crear factura S/3000 base (IGV excluido)
        r = await c.post(f"{API}/facturas-proveedor", json={
            "proveedor_id": 1, "moneda_id": 1, "fecha_factura": "2026-02-05",
            "tipo_documento": "factura", "impuestos_incluidos": False,
            "lineas": [
                {"descripcion": "Servicio Diseño", "importe": 1000, "igv_aplica": True},
                {"descripcion": "Servicio Patronaje", "importe": 1000, "igv_aplica": True},
                {"descripcion": "Confección Muestras", "importe": 1000, "igv_aplica": True}
            ]
        })
        fac2 = r.json()
        fac2_id = fac2['id']
        log(f"Factura2: id={fac2_id} sub={fac2['subtotal']:.2f} igv={fac2['igv']:.2f} total={fac2['total']:.2f}",
            r.status_code == 200 and abs(fac2['total'] - 3540) < 0.01)
        
        # 3.2 Generar 3 letras
        r = await c.post(f"{API}/letras/generar", json={
            "factura_id": fac2_id, "cantidad_letras": 3, "dias_entre_letras": 30
        })
        letras = r.json()
        log(f"Letras generadas: {len(letras)}", isinstance(letras, list) and len(letras) == 3)
        total_letras = sum(l['monto'] for l in letras)
        log(f"Total letras={total_letras:.2f} vs factura={fac2['total']:.2f}", abs(total_letras - fac2['total']) < 0.01)
        
        # Verificar factura canjeada
        r = await c.get(f"{API}/facturas-proveedor/{fac2_id}")
        log(f"Factura canjeada: estado={r.json()['estado']}", r.json()['estado'] == 'canjeado')
        
        # 3.3 Pagar primera letra completa
        l1_id = letras[0]['id']
        l1_monto = letras[0]['monto']
        r = await c.post(f"{API}/pagos", json={
            "tipo": "egreso", "fecha": "2026-02-10", "moneda_id": 1, "monto_total": l1_monto,
            "detalles": [{"cuenta_financiera_id": 1, "medio_pago": "transferencia", "monto": l1_monto}],
            "aplicaciones": [{"tipo_documento": "letra", "documento_id": l1_id, "monto_aplicado": l1_monto}]
        })
        log(f"Pago Letra1 completa: S/{l1_monto:.2f}", r.status_code == 200)
        
        # 3.4 Pagar segunda letra PARCIAL (500 de 1180)
        l2_id = letras[1]['id']
        r = await c.post(f"{API}/pagos", json={
            "tipo": "egreso", "fecha": "2026-03-01", "moneda_id": 1, "monto_total": 500,
            "detalles": [{"cuenta_financiera_id": 3, "medio_pago": "transferencia", "monto": 500}],
            "aplicaciones": [{"tipo_documento": "letra", "documento_id": l2_id, "monto_aplicado": 500}]
        })
        log(f"Pago Letra2 parcial: S/500", r.status_code == 200)
        
        # Verificar estados letras
        r = await c.get(f"{API}/letras")
        all_letras = [l for l in r.json() if l['factura_id'] == fac2_id]
        l1_state = next(l for l in all_letras if l['id'] == l1_id)
        l2_state = next(l for l in all_letras if l['id'] == l2_id)
        l3_state = next(l for l in all_letras if l['id'] == letras[2]['id'])
        log(f"Letra1: estado={l1_state['estado']} saldo={l1_state['saldo_pendiente']:.2f}", l1_state['estado'] == 'pagada')
        log(f"Letra2: estado={l2_state['estado']} saldo={l2_state['saldo_pendiente']:.2f}", l2_state['estado'] == 'parcial' and abs(l2_state['saldo_pendiente'] - 680) < 0.01)
        log(f"Letra3: estado={l3_state['estado']} saldo={l3_state['saldo_pendiente']:.2f}", l3_state['estado'] == 'pendiente')
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 4: GASTOS CON PAGO INMEDIATO")
        print("="*60)
        
        # 4.1 Gasto útiles - el pago debe igualar el total con IGV
        # Importe 423.73 + IGV 76.27 = 500
        r = await c.post(f"{API}/gastos", json={
            "fecha": "2026-02-05", "proveedor_id": 1, "moneda_id": 1,
            "tipo_documento": "boleta", "numero_documento": "B001-00001",
            "lineas": [
                {"categoria_id": 4, "descripcion": "Útiles escritorio", "importe": 250, "igv_aplica": True, "centro_costo_id": 1},
                {"categoria_id": 4, "descripcion": "Papel bond A4", "importe": 173.73, "igv_aplica": True, "centro_costo_id": 1}
            ],
            "pagos": [{"cuenta_financiera_id": 2, "medio_pago": "efectivo", "monto": 500}]
        })
        g1 = r.json()
        log(f"Gasto1 útiles: id={g1.get('id')} total={g1.get('total',0):.2f} pago_id={g1.get('pago_id')}",
            r.status_code == 200 and g1.get('pago_id') is not None)
        
        # 4.2 Gasto servicios - 1016.95 base + IGV = 1200
        r = await c.post(f"{API}/gastos", json={
            "fecha": "2026-02-05", "moneda_id": 1, "beneficiario_nombre": "Consultora XYZ",
            "tipo_documento": "factura", "numero_documento": "F001-00234",
            "lineas": [
                {"categoria_id": 4, "descripcion": "Consultoría financiera Enero", "importe": 1016.95, "igv_aplica": True, "centro_costo_id": 1}
            ],
            "pagos": [{"cuenta_financiera_id": 1, "medio_pago": "transferencia", "monto": 1200, "referencia": "OP-205"}]
        })
        g2 = r.json()
        log(f"Gasto2 servicios: id={g2.get('id')} total={g2.get('total',0):.2f} pago_id={g2.get('pago_id')}",
            r.status_code == 200 and g2.get('pago_id') is not None)
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 5: ADELANTOS DE EMPLEADOS")
        print("="*60)
        
        # 5.1 Adelanto Juan Pérez S/300 (pagar inmediatamente)
        r = await c.post(f"{API}/adelantos", json={
            "empleado_id": 9, "fecha": "2026-02-01", "monto": 300,
            "motivo": "Adelanto quincena", "pagar": True,
            "cuenta_financiera_id": 2, "medio_pago": "efectivo"
        })
        adel1 = r.json()
        log(f"Adelanto Juan: id={adel1.get('id')} monto={adel1.get('monto')} pagado={adel1.get('pagado')}",
            r.status_code == 200 and adel1.get('pagado') == True)
        adel1_id = adel1.get('id')
        
        # 5.2 Adelanto María S/500 (sin pagar)
        r = await c.post(f"{API}/adelantos", json={
            "empleado_id": 10, "fecha": "2026-02-01", "monto": 500,
            "motivo": "Adelanto emergencia", "pagar": False
        })
        adel2 = r.json()
        log(f"Adelanto María (sin pagar): id={adel2.get('id')} pagado={adel2.get('pagado')}",
            r.status_code == 200 and adel2.get('pagado') == False)
        adel2_id = adel2.get('id')
        
        # 5.3 Pagar adelanto María
        r = await c.post(f"{API}/adelantos/{adel2_id}/pagar?cuenta_financiera_id=1&medio_pago=transferencia")
        adel2_paid = r.json()
        log(f"Adelanto María pagado: pagado={adel2_paid.get('pagado')} pago_id={adel2_paid.get('pago_id')}",
            adel2_paid.get('pagado') == True and adel2_paid.get('pago_id') is not None)
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 6: PLANILLA + PAGO")
        print("="*60)
        
        # 6.1 Crear planilla Enero 2026
        r = await c.post(f"{API}/planillas", json={
            "periodo": "2026-01", "fecha_inicio": "2026-01-01", "fecha_fin": "2026-01-31",
            "detalles": [
                {"empleado_id": 9, "salario_base": 2000, "bonificaciones": 200, "adelantos": 300, "otros_descuentos": 50},
                {"empleado_id": 10, "salario_base": 2500, "bonificaciones": 150, "adelantos": 500, "otros_descuentos": 0},
                {"empleado_id": 11, "salario_base": 1500, "bonificaciones": 100, "adelantos": 0, "otros_descuentos": 30}
            ]
        })
        plan = r.json()
        # Juan: 2000+200-300-50 = 1850
        # María: 2500+150-500-0 = 2150
        # Carlos: 1500+100-0-30 = 1570
        # Total neto: 5570
        expected_neto = 1850 + 2150 + 1570
        log(f"Planilla: id={plan.get('id')} bruto={plan.get('total_bruto',0):.2f} neto={plan.get('total_neto',0):.2f} (esperado={expected_neto})",
            r.status_code == 200 and abs(plan.get('total_neto', 0) - expected_neto) < 0.01)
        plan_id = plan.get('id')
        
        # Verificar detalles
        if plan.get('detalles'):
            for d in plan['detalles']:
                print(f"    {d.get('empleado_nombre','?')}: bruto={d.get('salario_base',0)+d.get('bonificaciones',0):.2f} desc={d.get('adelantos',0)+d.get('otros_descuentos',0):.2f} neto={d.get('neto_pagar',0):.2f}")
        
        # 6.2 Pagar planilla
        r = await c.post(f"{API}/planillas/{plan_id}/pagar?cuenta_financiera_id=1")
        plan_paid = r.json()
        log(f"Planilla pagada: estado={plan_paid.get('estado')} pago_id={plan_paid.get('pago_id')}",
            plan_paid.get('estado') == 'pagada' and plan_paid.get('pago_id') is not None)
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 7: VENTAS POS (Odoo Sync)")
        print("="*60)
        
        try:
            r = await c.post(f"{API}/ventas-pos/sync?company=ambission&days_back=5", timeout=60)
            sync = r.json()
            log(f"Sync Odoo: {sync}", r.status_code == 200)
        except Exception as e:
            log(f"Sync Odoo timeout/error: {e}", None)
        
        # Check ventas loaded
        r = await c.get(f"{API}/ventas-pos")
        ventas = r.json()
        log(f"Ventas POS cargadas: {len(ventas)}", len(ventas) > 0 if isinstance(ventas, list) else False)
        
        if isinstance(ventas, list) and len(ventas) > 0:
            # Confirmar primera venta
            v1_id = ventas[0]['id']
            r = await c.post(f"{API}/ventas-pos/{v1_id}/confirmar")
            log(f"Venta {v1_id} confirmada: {r.json().get('estado','?')}", r.status_code == 200)
            
            if len(ventas) > 1:
                v2_id = ventas[1]['id']
                r = await c.post(f"{API}/ventas-pos/{v2_id}/confirmar")
                log(f"Venta {v2_id} confirmada: {r.json().get('estado','?')}", r.status_code == 200)
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 8: SEGUNDA OC (IGV excluido)")
        print("="*60)
        
        r = await c.post(f"{API}/ordenes-compra", json={
            "fecha": "2026-02-06", "proveedor_id": 1, "moneda_id": 1, "igv_incluido": False,
            "lineas": [
                {"descripcion": "Botones metálicos x1000", "cantidad": 1000, "precio_unitario": 0.50, "igv_aplica": True},
                {"descripcion": "Cierres YKK x500", "cantidad": 500, "precio_unitario": 1.20, "igv_aplica": True}
            ]
        })
        oc2 = r.json()
        # 1000*0.5 + 500*1.2 = 500 + 600 = 1100
        # IGV = 1100*0.18 = 198
        # Total = 1298
        log(f"OC2 (IGV excl): sub={oc2.get('subtotal',0):.2f} igv={oc2.get('igv',0):.2f} total={oc2.get('total',0):.2f}",
            r.status_code == 200 and abs(oc2.get('total', 0) - 1298) < 0.01)
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 9: VERIFICACIÓN CxP")
        print("="*60)
        
        r = await c.get(f"{API}/cxp")
        cxps = r.json()
        log(f"CxP registros: {len(cxps)}", isinstance(cxps, list))
        if isinstance(cxps, list):
            for cx in cxps:
                print(f"    CxP: {cx.get('proveedor_nombre','?')} total={cx.get('total',0):.2f} saldo={cx.get('saldo_pendiente',0):.2f} estado={cx.get('estado','?')}")
        
        # =====================================================
        print("\n" + "="*60)
        print("FLOW 10: DASHBOARD KPIs")
        print("="*60)
        
        r = await c.get(f"{API}/dashboard/kpis")
        kpis = r.json()
        log(f"Dashboard KPIs: {json.dumps(kpis, indent=2)[:300]}", r.status_code == 200)
        
        # =====================================================
        print("\n" + "="*60)
        print("RESUMEN FINAL")
        print("="*60)
        
        passed = sum(1 for r in RESULTS if r['ok'] == True)
        failed = sum(1 for r in RESULTS if r['ok'] == False)
        skipped = sum(1 for r in RESULTS if r['ok'] is None)
        total = len(RESULTS)
        print(f"\n  TOTAL: {total} tests")
        print(f"  PASSED: {passed}")
        print(f"  FAILED: {failed}")
        print(f"  SKIPPED: {skipped}")
        
        if failed > 0:
            print("\n  FALLOS:")
            for r in RESULTS:
                if r['ok'] == False:
                    print(f"    - {r['msg']}")

asyncio.run(main())
