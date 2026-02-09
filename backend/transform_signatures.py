"""
Transform server.py to add empresa_id dependency to all remaining endpoints.
This script handles:
1. Function signatures - add empresa_id param
2. SQL conditions - add empresa_id filtering
3. SQL inserts - add empresa_id column
"""
import re

with open('/app/backend/server.py', 'r') as f:
    content = f.read()

# Track what we've already modified (these have empresa_id already)
already_done = [
    'get_dashboard_kpis', 'list_categorias', 'create_categoria', 'update_categoria', 'delete_categoria',
    'list_centros_costo', 'create_centro_costo', 'delete_centro_costo',
    'list_lineas_negocio', 'create_linea_negocio', 'delete_linea_negocio',
    'list_cuentas_financieras', 'create_cuenta_financiera', 'update_cuenta_financiera', 'delete_cuenta_financiera',
    'list_terceros', 'get_tercero', 'create_tercero', 'update_tercero', 'delete_tercero',
    'list_proveedores', 'list_clientes', 'list_empleados',
]

# Global endpoints that should NOT get empresa_id
global_endpoints = [
    'root', 'health', 'list_empresas', 'create_empresa', 'update_empresa', 'delete_empresa',
    'list_monedas', 'create_moneda', 'delete_moneda', 'startup', 'shutdown', 'seed_data',
]

# Helper functions that are not endpoints but need empresa_id param
helper_functions = [
    'generate_oc_number', 'generate_factura_number', 'generate_pago_number', 'generate_gasto_number',
    'get_factura_proveedor',
]

lines = content.split('\n')
output = []
i = 0
modified_count = 0

while i < len(lines):
    line = lines[i]
    
    # Check for async def that's an endpoint handler
    match = re.match(r'^async def (\w+)\(', line)
    if match:
        func_name = match.group(1)
        
        # Skip already done and global
        if func_name in already_done or func_name in global_endpoints:
            output.append(line)
            i += 1
            continue
        
        # Check if empresa_id already in signature
        if 'empresa_id' in line or 'get_empresa_id' in line:
            output.append(line)
            i += 1
            continue
        
        # For helper functions, add empresa_id as regular param
        if func_name in helper_functions:
            if func_name == 'get_factura_proveedor':
                line = line.replace('async def get_factura_proveedor(id: int)', 
                                   'async def get_factura_proveedor(id: int, empresa_id: int)')
            elif 'generate_' in func_name:
                line = line.replace('(conn)', '(conn, empresa_id: int)')
            output.append(line)
            i += 1
            modified_count += 1
            continue
        
        # For endpoint functions, add Depends(get_empresa_id)
        # Find the closing paren of the function signature
        sig_lines = [line]
        j = i + 1
        paren_count = line.count('(') - line.count(')')
        while paren_count > 0 and j < len(lines):
            sig_lines.append(lines[j])
            paren_count += lines[j].count('(') - lines[j].count(')')
            j += 1
        
        full_sig = '\n'.join(sig_lines)
        
        if 'empresa_id' not in full_sig and 'get_empresa_id' not in full_sig:
            # Add empresa_id param - insert after first paren
            if len(sig_lines) == 1:
                # Single-line signature
                if line.strip().endswith('):'):
                    # No params: async def func():
                    line = line.replace('):', ', empresa_id: int = Depends(get_empresa_id)):')
                    if '(, ' in line:
                        line = line.replace('(, ', '(')
                elif 'data:' in line and ')' in line:
                    # Has data param: async def func(data: Type):
                    line = line.replace('):', ', empresa_id: int = Depends(get_empresa_id)):')
                else:
                    line = line.replace('):', ', empresa_id: int = Depends(get_empresa_id)):')
                output.append(line)
                i += 1
            else:
                # Multi-line signature - add before closing paren
                # Find the line with the closing ):
                for k, sl in enumerate(sig_lines):
                    if k == 0:
                        output.append(sl)
                    elif '):' in sl and paren_count <= 0:
                        # Add empresa_id before this closing
                        indent = '    '
                        output.append(f'{indent}empresa_id: int = Depends(get_empresa_id),')
                        output.append(sl)
                    else:
                        output.append(sl)
                i = j
            modified_count += 1
            continue
    
    output.append(line)
    i += 1

content = '\n'.join(output)

# Now fix the generate_* functions to filter by empresa_id
# generate_oc_number
content = content.replace(
    "async def generate_oc_number(conn) -> str:",
    "async def generate_oc_number(conn, empresa_id: int) -> str:"
)
content = content.replace(
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_oc 
        WHERE numero LIKE '{prefix}%' 
        ORDER BY id DESC LIMIT 1
    \"\"\")""",
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_oc 
        WHERE numero LIKE '{prefix}%' AND empresa_id = $1
        ORDER BY id DESC LIMIT 1
    \"\"\", empresa_id)"""
)

# generate_factura_number
content = content.replace(
    "async def generate_factura_number(conn) -> str:",
    "async def generate_factura_number(conn, empresa_id: int) -> str:"
)
content = content.replace(
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_factura_proveedor 
        WHERE numero LIKE '{prefix}%' 
        ORDER BY id DESC LIMIT 1
    \"\"\")""",
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_factura_proveedor 
        WHERE numero LIKE '{prefix}%' AND empresa_id = $1
        ORDER BY id DESC LIMIT 1
    \"\"\", empresa_id)"""
)

# generate_pago_number
content = content.replace(
    "async def generate_pago_number(conn, tipo: str) -> str:",
    "async def generate_pago_number(conn, tipo: str, empresa_id: int) -> str:"
)
content = content.replace(
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_pago 
        WHERE numero LIKE '{prefix}%' 
        ORDER BY id DESC LIMIT 1
    \"\"\")""",
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_pago 
        WHERE numero LIKE '{prefix}%' AND empresa_id = $1
        ORDER BY id DESC LIMIT 1
    \"\"\", empresa_id)"""
)

# generate_gasto_number
content = content.replace(
    "async def generate_gasto_number(conn) -> str:",
    "async def generate_gasto_number(conn, empresa_id: int) -> str:"
)
content = content.replace(
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_gasto 
        WHERE numero LIKE '{prefix}%' 
        ORDER BY id DESC LIMIT 1
    \"\"\")""",
    """    last = await conn.fetchval(f\"\"\"
        SELECT numero FROM finanzas2.cont_gasto 
        WHERE numero LIKE '{prefix}%' AND empresa_id = $1
        ORDER BY id DESC LIMIT 1
    \"\"\", empresa_id)"""
)

# Fix generate_* calls to pass empresa_id
content = content.replace('generate_oc_number(conn)', 'generate_oc_number(conn, empresa_id)')
content = content.replace('generate_factura_number(conn)', 'generate_factura_number(conn, empresa_id)')
content = content.replace('generate_pago_number(conn, tipo)', 'generate_pago_number(conn, tipo, empresa_id)')
content = content.replace("generate_pago_number(conn, 'egreso')", "generate_pago_number(conn, 'egreso', empresa_id)")
content = content.replace("generate_pago_number(conn, 'ingreso')", "generate_pago_number(conn, 'ingreso', empresa_id)")
content = content.replace('generate_gasto_number(conn)', 'generate_gasto_number(conn, empresa_id)')

# Fix get_factura_proveedor helper call
content = content.replace(
    'async def get_factura_proveedor(id: int) -> dict:',
    'async def get_factura_proveedor(id: int, empresa_id: int) -> dict:'
)
content = content.replace(
    'return await get_factura_proveedor(id)',
    'return await get_factura_proveedor(id, empresa_id)'
)

with open('/app/backend/server.py', 'w') as f:
    f.write(content)

print(f"Modified {modified_count} function signatures")
print("Also updated generate_* functions and their call sites")
