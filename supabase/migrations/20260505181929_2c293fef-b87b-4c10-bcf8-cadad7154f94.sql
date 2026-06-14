
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  purity_tier TEXT NOT NULL,
  price_tier INT NOT NULL DEFAULT 2,
  energy_tags TEXT[] NOT NULL DEFAULT '{}',
  context_tags TEXT[] NOT NULL DEFAULT '{}',
  signature_dish TEXT NOT NULL,
  dish_outcome TEXT NOT NULL,
  doordash_url TEXT,
  ubereats_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.restaurants FOR SELECT USING (true);

INSERT INTO public.restaurants (name, cuisine, purity_tier, price_tier, energy_tags, context_tags, signature_dish, dish_outcome, doordash_url, ubereats_url) VALUES
('Selland''s Market-Cafe', 'American', 'sovereign', 2, ARRAY['grounding','restorative'], ARRAY['solo','family'], 'Braised Short Rib with Root Vegetables', 'deep grounding and sustained warmth', 'https://www.doordash.com/search/store/sellands', 'https://www.ubereats.com/search?q=sellands'),
('Visconti''s Ristorante', 'Italian', 'sovereign', 3, ARRAY['celebratory','warming'], ARRAY['social','celebratory'], 'Osso Buco alla Milanese', 'celebratory grounding with rich nourishment', 'https://www.doordash.com/search/store/viscontis', 'https://www.ubereats.com/search?q=viscontis'),
('Jalisco''s Grill', 'Mexican', 'standard', 1, ARRAY['energizing','warming'], ARRAY['solo','social'], 'Carne Asada with Charro Beans', 'protein-forward fuel with quick warmth', 'https://www.doordash.com/search/store/jaliscos', 'https://www.ubereats.com/search?q=jaliscos'),
('Thai Paradise', 'Thai', 'standard', 1, ARRAY['grounding','warming'], ARRAY['solo','fast'], 'Tom Kha Gai (Coconut Chicken Soup)', 'gentle warming restoration for depleted state', 'https://www.doordash.com/search/store/thai-paradise', 'https://www.ubereats.com/search?q=thai+paradise'),
('Sky Sushi', 'Japanese', 'satellite', 2, ARRAY['light','peak'], ARRAY['solo','social'], 'Chirashi Bowl with Wild Salmon', 'clean light protein for peak clarity', 'https://www.doordash.com/search/store/sky-sushi', 'https://www.ubereats.com/search?q=sky+sushi'),
('Mythaai', 'Indian', 'sovereign', 2, ARRAY['grounding','restorative','warming'], ARRAY['solo','family'], 'Ghee-Tempered Dal with Basmati', 'deep cellular restoration with ghee-based grounding', 'https://www.doordash.com/search/store/mythaai', 'https://www.ubereats.com/search?q=mythaai');
