-- ============================================================
-- Boys Trip Planner — Supabase Schema
-- Run this in your Supabase project: SQL Editor > New Query
-- ============================================================

-- 1. ALLOWED EMAILS (invite gate)
CREATE TABLE allowed_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES (auto-created on Google sign-in)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: block sign-in if email not in allowed_emails
CREATE OR REPLACE FUNCTION check_allowed_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE LOWER(email) = LOWER(NEW.email)
  ) THEN
    RAISE EXCEPTION 'Email not on invite list';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_invite_list
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION check_allowed_email();


-- 3. TRIPS
CREATE TABLE trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TRIP RSVP
CREATE TABLE trip_rsvp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in', 'out', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- 5. ITINERARY NOTES (one doc per trip)
CREATE TABLE itinerary_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE UNIQUE,
  body TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BUDGET ITEMS
CREATE TABLE budget_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AVAILABILITY POLLS
CREATE TABLE avail_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  trip_days INT NOT NULL DEFAULT 4,
  start_dow INT NOT NULL DEFAULT 5,       -- 0=Sun … 6=Sat
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE avail_slot_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES avail_polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  slot_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id, slot_start)
);

CREATE TABLE avail_opt_outs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES avail_polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- 8. POLLS
CREATE TABLE polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('destination', 'activity', 'general')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closes_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- 9. PHOTOS
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ANNOUNCEMENTS
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. BINGO ITEMS (pool per trip)
CREATE TABLE bingo_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. BINGO CARDS (one per user per trip, generated from pool)
CREATE TABLE bingo_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  squares JSONB NOT NULL,  -- array of 25 strings, index 12 = "FREE"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- 13. BINGO MARKS (which squares each user has marked)
CREATE TABLE bingo_marks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES bingo_cards(id) ON DELETE CASCADE,
  square_index INT NOT NULL CHECK (square_index BETWEEN 0 AND 24),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, square_index, user_id)
);

-- 14. PROP BETS
CREATE TABLE prop_bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prop_bet_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bet_id UUID REFERENCES prop_bets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  prediction BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bet_id, user_id)
);

CREATE TABLE prop_bet_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bet_id UUID REFERENCES prop_bets(id) ON DELETE CASCADE UNIQUE,
  result BOOLEAN NOT NULL,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. QUOTES
CREATE TABLE quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  attributed_to TEXT NOT NULL,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_rsvp ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE avail_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE avail_slot_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE avail_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_bet_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_bet_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an authenticated member?
CREATE OR REPLACE FUNCTION is_member()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false)
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: members can read all, update own
CREATE POLICY "members read profiles" ON profiles FOR SELECT USING (is_member());
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Allowed emails: admins manage, members read
CREATE POLICY "members read allowed_emails" ON allowed_emails FOR SELECT USING (is_member());
CREATE POLICY "admins manage allowed_emails" ON allowed_emails FOR ALL USING (is_admin());

-- Trips: members read, admins write
CREATE POLICY "members read trips" ON trips FOR SELECT USING (is_member());
CREATE POLICY "admins manage trips" ON trips FOR ALL USING (is_admin());

-- Trip RSVP: members read all, manage own
CREATE POLICY "members read rsvps" ON trip_rsvp FOR SELECT USING (is_member());
CREATE POLICY "manage own rsvp" ON trip_rsvp FOR ALL USING (auth.uid() = user_id);

-- Itinerary notes: members read/write
CREATE POLICY "members read notes" ON itinerary_notes FOR SELECT USING (is_member());
CREATE POLICY "members write notes" ON itinerary_notes FOR ALL USING (is_member());

-- Budget: members read/write
CREATE POLICY "members read budget" ON budget_items FOR SELECT USING (is_member());
CREATE POLICY "members write budget" ON budget_items FOR INSERT WITH CHECK (is_member());
CREATE POLICY "admins delete budget" ON budget_items FOR DELETE USING (is_admin());

-- Avail polls: members read, any member creates, admins delete
CREATE POLICY "members read avail_polls" ON avail_polls FOR SELECT USING (is_member());
CREATE POLICY "members create avail_polls" ON avail_polls FOR INSERT WITH CHECK (is_member());
CREATE POLICY "admins delete avail_polls" ON avail_polls FOR DELETE USING (is_admin());

-- Avail slot votes: members read all, manage own
CREATE POLICY "members read avail_slot_votes" ON avail_slot_votes FOR SELECT USING (is_member());
CREATE POLICY "manage own avail_slot_votes" ON avail_slot_votes FOR ALL USING (auth.uid() = user_id);

-- Avail opt-outs: members read all, manage own
CREATE POLICY "members read avail_opt_outs" ON avail_opt_outs FOR SELECT USING (is_member());
CREATE POLICY "manage own avail_opt_outs" ON avail_opt_outs FOR ALL USING (auth.uid() = user_id);

-- Polls: members read, any member can create
CREATE POLICY "members read polls" ON polls FOR SELECT USING (is_member());
CREATE POLICY "members create polls" ON polls FOR INSERT WITH CHECK (is_member());
CREATE POLICY "admins delete polls" ON polls FOR DELETE USING (is_admin());

-- Poll options: members read, poll creator or admin manages
CREATE POLICY "members read options" ON poll_options FOR SELECT USING (is_member());
CREATE POLICY "members insert options" ON poll_options FOR INSERT WITH CHECK (is_member());

-- Poll votes: members read/write own
CREATE POLICY "members read votes" ON poll_votes FOR SELECT USING (is_member());
CREATE POLICY "manage own vote" ON poll_votes FOR ALL USING (auth.uid() = user_id);

-- Photos: members read/write
CREATE POLICY "members read photos" ON photos FOR SELECT USING (is_member());
CREATE POLICY "members upload photos" ON photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members delete own photos" ON photos FOR DELETE USING (auth.uid() = user_id OR is_admin());

-- Announcements: members read, admins write
CREATE POLICY "members read announcements" ON announcements FOR SELECT USING (is_member());
CREATE POLICY "admins write announcements" ON announcements FOR ALL USING (is_admin());

-- Bingo items: members read, any member adds
CREATE POLICY "members read bingo_items" ON bingo_items FOR SELECT USING (is_member());
CREATE POLICY "members add bingo_items" ON bingo_items FOR INSERT WITH CHECK (is_member());
CREATE POLICY "delete own bingo_item" ON bingo_items FOR DELETE USING (auth.uid() = added_by OR is_admin());

-- Bingo cards: members read all, own cards
CREATE POLICY "members read bingo_cards" ON bingo_cards FOR SELECT USING (is_member());
CREATE POLICY "manage own bingo_card" ON bingo_cards FOR ALL USING (auth.uid() = user_id);

-- Bingo marks: members read all, own marks
CREATE POLICY "members read bingo_marks" ON bingo_marks FOR SELECT USING (is_member());
CREATE POLICY "manage own bingo_marks" ON bingo_marks FOR ALL USING (auth.uid() = user_id);

-- Prop bets: members read/write
CREATE POLICY "members read prop_bets" ON prop_bets FOR SELECT USING (is_member());
CREATE POLICY "members create prop_bets" ON prop_bets FOR INSERT WITH CHECK (is_member());
CREATE POLICY "admins delete prop_bets" ON prop_bets FOR DELETE USING (is_admin());

CREATE POLICY "members read bet_votes" ON prop_bet_votes FOR SELECT USING (is_member());
CREATE POLICY "manage own bet_vote" ON prop_bet_votes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "members read bet_results" ON prop_bet_results FOR SELECT USING (is_member());
CREATE POLICY "admins write bet_results" ON prop_bet_results FOR ALL USING (is_admin());

-- Quotes: members read/write
CREATE POLICY "members read quotes" ON quotes FOR SELECT USING (is_member());
CREATE POLICY "members add quotes" ON quotes FOR INSERT WITH CHECK (is_member());
CREATE POLICY "delete own or admin" ON quotes FOR DELETE USING (auth.uid() = added_by OR is_admin());


-- ============================================================
-- STORAGE BUCKET (run separately in Storage dashboard or here)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('trip-photos', 'trip-photos', true);
-- CREATE POLICY "members upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'trip-photos' AND auth.role() = 'authenticated');
-- CREATE POLICY "public read" ON storage.objects FOR SELECT USING (bucket_id = 'trip-photos');
-- CREATE POLICY "delete own" ON storage.objects FOR DELETE USING (bucket_id = 'trip-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
