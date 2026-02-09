"""Fix all INSERT statements to include empresa_id."""
with open('/app/backend/server.py', 'r') as f:
    content = f.read()

# Global/seed tables that should NOT get empresa_id in INSERT
GLOBAL_TABLES = ['cont_empresa', 'cont_moneda', 'cont_tipo_cambio']

# Tables that already have empresa_id in their INSERT (from earlier edits)
ALREADY_DONE = ['cont_categoria', 'cont_centro_costo', 'cont_linea_negocio',
                'cont_cuenta_financiera', 'cont_tercero']

fixes = {
    # OC INSERT
    (
        '(numero, fecha, proveedor_id, moneda_id, estado, subtotal, igv, total, notas)\n                VALUES ($1, $2, $3, $4, \'borrador\', $5, $6, $7, $8)',
        '""", numero, data.fecha, data.proveedor_id, data.moneda_id, subtotal, igv, total, data.notas)'
    ): (
        '(empresa_id, numero, fecha, proveedor_id, moneda_id, estado, subtotal, igv, total, notas)\n                VALUES ($1, $2, $3, $4, $5, \'borrador\', $6, $7, $8, $9)',
        '""", empresa_id, numero, data.fecha, data.proveedor_id, data.moneda_id, subtotal, igv, total, data.notas)'
    ),
    # OC Linea INSERT
    (
        '(oc_id, articulo_id, descripcion, cantidad, precio_unitario, igv_aplica, subtotal)\n                    VALUES ($1, $2, $3, $4, $5, $6, $7)',
        '""", oc_id, articulo_id_value, linea.descripcion, linea.cantidad, \n                    linea.precio_unitario, linea.igv_aplica, linea_subtotal)'
    ): (
        '(empresa_id, oc_id, articulo_id, descripcion, cantidad, precio_unitario, igv_aplica, subtotal)\n                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        '""", empresa_id, oc_id, articulo_id_value, linea.descripcion, linea.cantidad, \n                    linea.precio_unitario, linea.igv_aplica, linea_subtotal)'
    ),
}

for (old_cols, old_vals), (new_cols, new_vals) in fixes.items():
    if old_cols in content:
        content = content.replace(old_cols, new_cols)
        content = content.replace(old_vals, new_vals)
        print(f"Fixed: {old_cols[:60]}...")
    else:
        print(f"NOT FOUND: {old_cols[:60]}...")

with open('/app/backend/server.py', 'w') as f:
    f.write(content)

print("\nDone with dict-based fixes")
