-- ============================================================
-- BOLIVAR COFFEE & LOUNGE — Production Database Schema
-- Supabase PostgreSQL with Row Level Security
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- MENU CATEGORIES
-- ============================================================
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MENU ITEMS
-- ============================================================
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,3) NOT NULL CHECK (price >= 0),
  image_url TEXT DEFAULT '',
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX idx_menu_items_available ON public.menu_items(is_available);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT DEFAULT 'Guest' CHECK (length(customer_name) <= 100),
  rating INT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 1000),
  source TEXT DEFAULT 'website' CHECK (source IN ('website', 'google', 'instagram')),
  is_approved BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reviews_approved ON public.reviews(is_approved);

-- ============================================================
-- GALLERY IMAGES
-- ============================================================
CREATE TABLE public.gallery_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  storage_path TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gallery_order ON public.gallery_images(display_order);

-- ============================================================
-- BUSINESS SETTINGS
-- ============================================================
CREATE TABLE public.business_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_menu_items_updated BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t_reviews_updated BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t_gallery_updated BEFORE UPDATE ON public.gallery_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t_settings_updated BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- MENU CATEGORIES (public read active, admin manage all)
CREATE POLICY "Public can view active categories" ON public.menu_categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON public.menu_categories
  FOR ALL USING (public.is_admin());

-- MENU ITEMS (public read available, admin manage all)
CREATE POLICY "Public can view available items" ON public.menu_items
  FOR SELECT USING (is_available = true);
CREATE POLICY "Admins can view all items" ON public.menu_items
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert items" ON public.menu_items
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update items" ON public.menu_items
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete items" ON public.menu_items
  FOR DELETE USING (public.is_admin());

-- REVIEWS (public read approved, anyone can submit, admin manage)
CREATE POLICY "Public can view approved reviews" ON public.reviews
  FOR SELECT USING (is_approved = true);
CREATE POLICY "Admins can view all reviews" ON public.reviews
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Anyone can submit reviews" ON public.reviews
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update reviews" ON public.reviews
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete reviews" ON public.reviews
  FOR DELETE USING (public.is_admin());

-- GALLERY (public read active, admin manage)
CREATE POLICY "Public can view active gallery" ON public.gallery_images
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all gallery" ON public.gallery_images
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can manage gallery" ON public.gallery_images
  FOR ALL USING (public.is_admin());

-- SETTINGS (public read, admin write)
CREATE POLICY "Public can view settings" ON public.business_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.business_settings
  FOR ALL USING (public.is_admin());
