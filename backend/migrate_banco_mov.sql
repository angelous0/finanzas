-- Add new columns to cont_banco_mov_raw table
ALTER TABLE finanzas2.cont_banco_mov_raw 
ADD COLUMN IF NOT EXISTS monto DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS banco_excel VARCHAR(100);

-- Migrate existing data: calculate monto from cargo/abono
UPDATE finanzas2.cont_banco_mov_raw
SET monto = COALESCE(abono, 0) - COALESCE(cargo, 0)
WHERE monto IS NULL;

-- Set banco_excel from banco if empty
UPDATE finanzas2.cont_banco_mov_raw
SET banco_excel = banco
WHERE banco_excel IS NULL OR banco_excel = '';
