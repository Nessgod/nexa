-- 1. Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla de Grupos para vincular parejas/equipos (Compartido)
CREATE TABLE Grupos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nombre TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de miembros del grupo
CREATE TABLE Grupo_Miembros (
    grupo_id UUID REFERENCES Grupos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, user_id)
);

-- 4. Tabla Gastos (Personal y Compartido)
-- Si grupo_id es NULL, el gasto es personal.
CREATE TABLE Gastos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    grupo_id UUID REFERENCES Grupos(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    monto NUMERIC NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla Tareas
-- Si grupo_id es NULL, la tarea es personal.
CREATE TABLE Tareas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    grupo_id UUID REFERENCES Grupos(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    completada BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE Grupos;
ALTER PUBLICATION supabase_realtime ADD TABLE Grupo_Miembros;
ALTER PUBLICATION supabase_realtime ADD TABLE Gastos;
ALTER PUBLICATION supabase_realtime ADD TABLE Tareas;

-- Políticas de Seguridad (RLS) opcionales para producción
-- ALTER TABLE Gastos ENABLE ROW LEVEL SECURITY;
-- (Aquí se configurarían las políticas para asegurar que cada usuario solo vea sus datos o los de su grupo)
