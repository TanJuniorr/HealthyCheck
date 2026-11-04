-- Widen the existing numeric(8,2) without changing any saved value or FK.
-- Fractional portions must survive a save/reload without rounding to 0.01 g.
ALTER TABLE public.meal_records ALTER COLUMN quantity_g TYPE numeric USING quantity_g::numeric;
