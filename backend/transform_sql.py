"""
Transform server.py SQL queries to filter by empresa_id.
Handles:
- List endpoints with conditions pattern -> add empresa_id condition
- INSERT statements -> add empresa_id column and value  
- get_factura_proveedor helper -> add empresa_id filter
"""
import re

with open('/app/backend/server.py', 'r') as f:
    content = f.read()

# ================================================================
# 1) Fix list endpoints with conditions = ["1=1"] pattern
# ================================================================
# For OC (ordenes-compra): alias oc
content = content.replace(
    '''    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SET search_path TO finanzas2, public")
        
        conditions = ["1=1"]
        params = []
        idx = 1
        
        if estado:
            conditions.append(f"oc.estado = ${idx}")''',
    '''    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SET search_path TO finanzas2, public")
        
        conditions = ["oc.empresa_id = $1"]
        params = [empresa_id]
        idx = 2
        
        if estado:
            conditions.append(f"oc.estado = ${idx}")''',
    1  # only first occurrence
)

# For facturas-proveedor: alias fp
content = content.replace(
    '''    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SET search_path TO finanzas2, public")
        
        conditions = ["1=1"]
        params = []
        idx = 1
        
        if estado:
            conditions.append(f"fp.estado = ${idx}")''',
    '''    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SET search_path TO finanzas2, public")
        
        conditions = ["fp.empresa_id = $1"]
        params = [empresa_id]
        idx = 2
        
        if estado:
            conditions.append(f"fp.estado = ${idx}")''',
    1
)

# For gastos: alias g
content = content.replace(
    '''    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SET search_path TO finanzas2, public")
        
        conditions = ["1=1"]
        params = []
        idx = 1
        
        if fecha_desde:
            conditions.append(f"g.fecha >= ${idx}")''',
    '''    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SET search_path TO finanzas2, public")
        
        conditions = ["g.empresa_id = $1"]
        params = [empresa_id]
        idx = 2
        
        if fecha_desde:
            conditions.append(f"g.fecha >= ${idx}")''',
    1
)

# ================================================================
# 2) Fix pagos list endpoint  
# ================================================================
content = content.replace(
    '''        conditions = ["1=1"]
        params = []
        idx = 1
        
        if tipo:
            conditions.append(f"p.tipo = ${idx}")''',
    '''        conditions = ["p.empresa_id = $1"]
        params = [empresa_id]
        idx = 2
        
        if tipo:
            conditions.append(f"p.tipo = ${idx}")''',
    1
)

# ================================================================
# 3) Fix letras list endpoint
# ================================================================
content = content.replace(
    '''        conditions = ["1=1"]
        params = []
        idx = 1
        
        if factura_id:
            conditions.append(f"l.factura_id = ${idx}")''',
    '''        conditions = ["l.empresa_id = $1"]
        params = [empresa_id]
        idx = 2
        
        if factura_id:
            conditions.append(f"l.factura_id = ${idx}")''',
    1
)

# ================================================================
# 4) Fix adelantos list - it already had empresa_id filter but partial
# ================================================================
# The adelantos endpoint already had empresa_id support partially, let's check
# and fix if needed

# ================================================================
# 5) Fix any remaining conditions = ["1=1"] patterns
# ================================================================
# For ventas-pos and other endpoints
remaining = content.count('conditions = ["1=1"]')
print(f"Remaining conditions = ['1=1'] patterns: {remaining}")

# ================================================================
# 6) Fix get_factura_proveedor helper to filter by empresa_id
# ================================================================
content = content.replace(
    '''            WHERE fp.id = $1
        """, id)''',
    '''            WHERE fp.id = $1 AND fp.empresa_id = $2
        """, id, empresa_id)''',
    1  # first occurrence is the helper
)

# ================================================================
# 7) Fix get_orden_compra to filter by empresa_id
# ================================================================
content = content.replace(
    '''            WHERE oc.id = $1
        """, id)
        
        if not row:
            raise HTTPException(404, "Orden de compra not found")''',
    '''            WHERE oc.id = $1 AND oc.empresa_id = $2
        """, id, empresa_id)
        
        if not row:
            raise HTTPException(404, "Orden de compra not found")'''
)

# ================================================================
# 8) Fix INSERT statements to include empresa_id
# ================================================================

# OC INSERT
content = content.replace(
    '''                INSERT INTO finanzas2.cont_oc 
                (numero, fecha, proveedor_id, moneda_id, estado, subtotal, igv, total, notas)
                VALUES ($1, TO_DATE($2, 'YYYY-MM-DD'), $3, $4, 'borrador', $5, $6, $7, $8)''',
    '''                INSERT INTO finanzas2.cont_oc 
                (empresa_id, numero, fecha, proveedor_id, moneda_id, estado, subtotal, igv, total, notas)
                VALUES ($1, $2, TO_DATE($3, 'YYYY-MM-DD'), $4, $5, 'borrador', $6, $7, $8, $9)'''
)
content = content.replace(
    "RETURNING *\n            \"\"\", numero, safe_date_param(data.fecha), data.proveedor_id, data.moneda_id, subtotal, igv, total, data.notas)",
    "RETURNING *\n            \"\"\", empresa_id, numero, safe_date_param(data.fecha), data.proveedor_id, data.moneda_id, subtotal, igv, total, data.notas)"
)

# OC Linea INSERT
content = content.replace(
    '''                INSERT INTO finanzas2.cont_oc_linea 
                (oc_id, articulo_id, descripcion, cantidad, precio_unitario, igv_aplica, subtotal)
                VALUES ($1, $2, $3, $4, $5, $6, $7)''',
    '''                INSERT INTO finanzas2.cont_oc_linea 
                (empresa_id, oc_id, articulo_id, descripcion, cantidad, precio_unitario, igv_aplica, subtotal)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'''
)
content = content.replace(
    "\"\"\", oc_id, linea.articulo_id, linea.descripcion, linea.cantidad, linea.precio_unitario, linea.igv_aplica, linea_subtotal)",
    "\"\"\", empresa_id, oc_id, linea.articulo_id, linea.descripcion, linea.cantidad, linea.precio_unitario, linea.igv_aplica, linea_subtotal)"
)

# Factura Proveedor INSERT
content = content.replace(
    '''                INSERT INTO finanzas2.cont_factura_proveedor 
                (numero, proveedor_id, beneficiario_nombre, moneda_id, fecha_factura, fecha_vencimiento, terminos_dias,
                 tipo_documento, subtotal, igv, total, saldo_pendiente, impuestos_incluidos, notas, oc_origen_id)
                VALUES ($1, $2, $3, $4, TO_DATE($5, 'YYYY-MM-DD'), TO_DATE($6, 'YYYY-MM-DD'), $7, $8, $9, $10, $11, $12, $13, $14, $15)''',
    '''                INSERT INTO finanzas2.cont_factura_proveedor 
                (empresa_id, numero, proveedor_id, beneficiario_nombre, moneda_id, fecha_factura, fecha_vencimiento, terminos_dias,
                 tipo_documento, subtotal, igv, total, saldo_pendiente, impuestos_incluidos, notas, oc_origen_id)
                VALUES ($1, $2, $3, $4, $5, TO_DATE($6, 'YYYY-MM-DD'), TO_DATE($7, 'YYYY-MM-DD'), $8, $9, $10, $11, $12, $13, $14, $15, $16)'''
)

# Factura proveedor linea INSERT
content = content.replace(
    '''                    INSERT INTO finanzas2.cont_factura_proveedor_linea 
                    (factura_id, categoria_id, articulo_id, descripcion, linea_negocio_id, 
                     centro_costo_id, importe, igv_aplica)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """, factura_id, linea.categoria_id, linea.articulo_id, linea.descripcion,''',
    '''                    INSERT INTO finanzas2.cont_factura_proveedor_linea 
                    (empresa_id, factura_id, categoria_id, articulo_id, descripcion, linea_negocio_id, 
                     centro_costo_id, importe, igv_aplica)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, empresa_id, factura_id, linea.categoria_id, linea.articulo_id, linea.descripcion,'''
)

# CXP INSERT
content = content.replace(
    '''                INSERT INTO finanzas2.cont_cxp 
                (factura_id, proveedor_id, monto_original, saldo_pendiente, fecha_vencimiento, estado)
                VALUES ($1, $2, $3, $4, TO_DATE($5, 'YYYY-MM-DD'), 'pendiente')''',
    '''                INSERT INTO finanzas2.cont_cxp 
                (empresa_id, factura_id, proveedor_id, monto_original, saldo_pendiente, fecha_vencimiento, estado)
                VALUES ($1, $2, $3, $4, $5, TO_DATE($6, 'YYYY-MM-DD'), 'pendiente')'''
)

# Gasto INSERT
content = content.replace(
    '''                INSERT INTO finanzas2.cont_gasto 
                (numero, fecha, proveedor_id, beneficiario_nombre, moneda_id, subtotal, igv, total,
                 tipo_documento, numero_documento, notas)
                VALUES ($1, TO_DATE($2, 'YYYY-MM-DD'), $3, $4, $5, $6, $7, $8, $9, $10, $11)''',
    '''                INSERT INTO finanzas2.cont_gasto 
                (empresa_id, numero, fecha, proveedor_id, beneficiario_nombre, moneda_id, subtotal, igv, total,
                 tipo_documento, numero_documento, notas)
                VALUES ($1, $2, TO_DATE($3, 'YYYY-MM-DD'), $4, $5, $6, $7, $8, $9, $10, $11, $12)'''
)

# Gasto Linea INSERT
content = content.replace(
    '''                    INSERT INTO finanzas2.cont_gasto_linea 
                    (gasto_id, categoria_id, descripcion, linea_negocio_id, centro_costo_id, importe, igv_aplica)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, gasto_id, linea.categoria_id, linea.descripcion, linea.linea_negocio_id,
                    linea.centro_costo_id, linea.importe, linea.igv_aplica)''',
    '''                    INSERT INTO finanzas2.cont_gasto_linea 
                    (empresa_id, gasto_id, categoria_id, descripcion, linea_negocio_id, centro_costo_id, importe, igv_aplica)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """, empresa_id, gasto_id, linea.categoria_id, linea.descripcion, linea.linea_negocio_id,
                    linea.centro_costo_id, linea.importe, linea.igv_aplica)'''
)

# ================================================================
# 9) Fix DELETE/UPDATE endpoints with WHERE id = $1
# ================================================================

# OC delete
content = content.replace(
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_oc WHERE id = $1", id)
        if result == "DELETE 0":
            raise HTTPException(404, "Orden de compra not found")''',
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_oc WHERE id = $1 AND empresa_id = $2", id, empresa_id)
        if result == "DELETE 0":
            raise HTTPException(404, "Orden de compra not found")'''
)

# Factura delete
content = content.replace(
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_factura_proveedor WHERE id = $1", id)
        if result == "DELETE 0":
            raise HTTPException(404, "Factura not found")''',
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_factura_proveedor WHERE id = $1 AND empresa_id = $2", id, empresa_id)
        if result == "DELETE 0":
            raise HTTPException(404, "Factura not found")'''
)

# Gasto delete
content = content.replace(
    '''    result = await conn.execute("DELETE FROM finanzas2.cont_gasto WHERE id = $1", id)
        if result == "DELETE 0":
            raise HTTPException(404, "Gasto not found")''',
    '''    result = await conn.execute("DELETE FROM finanzas2.cont_gasto WHERE id = $1 AND empresa_id = $2", id, empresa_id)
        if result == "DELETE 0":
            raise HTTPException(404, "Gasto not found")'''
)

# Letra delete
content = content.replace(
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_letra WHERE id = $1", id)
        if result == "DELETE 0":
            raise HTTPException(404, "Letra not found")''',
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_letra WHERE id = $1 AND empresa_id = $2", id, empresa_id)
        if result == "DELETE 0":
            raise HTTPException(404, "Letra not found")'''
)

# Adelanto delete
content = content.replace(
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_adelanto_empleado WHERE id = $1 AND pagado = FALSE", id)
        if result == "DELETE 0":
            raise HTTPException(404, "Adelanto not found or already paid")''',
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_adelanto_empleado WHERE id = $1 AND empresa_id = $2 AND pagado = FALSE", id, empresa_id)
        if result == "DELETE 0":
            raise HTTPException(404, "Adelanto not found or already paid")'''
)

# Planilla delete
content = content.replace(
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_planilla WHERE id = $1 AND estado = 'borrador'", id)
        if result == "DELETE 0":
            raise HTTPException(404, "Planilla not found or already paid")''',
    '''        result = await conn.execute("DELETE FROM finanzas2.cont_planilla WHERE id = $1 AND empresa_id = $2 AND estado = 'borrador'", id, empresa_id)
        if result == "DELETE 0":
            raise HTTPException(404, "Planilla not found or already paid")'''
)

# Pago delete
content = content.replace(
    '''        pago = await conn.fetchrow("SELECT * FROM finanzas2.cont_pago WHERE id = $1", id)
        if not pago:
            raise HTTPException(404, "Pago not found")''',
    '''        pago = await conn.fetchrow("SELECT * FROM finanzas2.cont_pago WHERE id = $1 AND empresa_id = $2", id, empresa_id)
        if not pago:
            raise HTTPException(404, "Pago not found")''',
    1
)

with open('/app/backend/server.py', 'w') as f:
    f.write(content)

print("SQL query transformations complete")
count = content.count('conditions = ["1=1"]')
print(f"Remaining conditions = ['1=1']: {count}")
