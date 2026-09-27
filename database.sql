-- SISTEMA OPERATIVO FINANCIERO (BOLA DE NIEVE)

-- 1. Tabla de Deudas
CREATE TABLE Finanzas_Deudas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    nombre TEXT NOT NULL,
    saldo NUMERIC NOT NULL,
    minimo NUMERIC NOT NULL
);

-- 2. Tabla del Ciclo (Estado de la bola de nieve)
CREATE TABLE Finanzas_Ciclo (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    mes INTEGER DEFAULT 1,
    fase INTEGER DEFAULT 0,
    pozo NUMERIC DEFAULT 0
);

-- 3. Tabla de Gastos e Ingresos Extra (Movimientos)
CREATE TABLE Finanzas_Movimientos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    descripcion TEXT NOT NULL,
    monto NUMERIC NOT NULL,
    tipo TEXT DEFAULT 'gasto', -- 'gasto' o 'ingreso'
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permisos RLS (Row Level Security) - Habilitados para seguridad
ALTER TABLE Finanzas_Deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE Finanzas_Ciclo ENABLE ROW LEVEL SECURITY;
ALTER TABLE Finanzas_Movimientos ENABLE ROW LEVEL SECURITY;

-- Políticas para que cada usuario vea solo sus datos
CREATE POLICY "Usuarios ven sus propias deudas" ON Finanzas_Deudas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Usuarios ven su propio ciclo" ON Finanzas_Ciclo FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Usuarios ven sus propios movimientos" ON Finanzas_Movimientos FOR ALL USING (auth.uid() = user_id);
