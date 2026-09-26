-- =============================================================================
-- Paws&Found — seed data
--
-- GENERATED from src/mock/ by scripts/gen-seed.mjs. Do not hand-edit: change
-- the mock data and regenerate, so the frontend demo and the database stay
-- identical.
--
-- Run AFTER database/schema.sql, which creates the tables and seeds the
-- categories and breeds this file depends on.
--
-- Every demo account's password is "demo1234" (bcrypt via PHP's
-- password_hash). Fictional accounts for demonstration only.
-- =============================================================================

USE pawsandfound;

-- Re-runnable: clear in reverse dependency order first.
--
-- audit_logs and login_attempts are cleared here rather than left to
-- cascade. login_attempts would go with its account anyway, but
-- audit_logs is ON DELETE SET NULL — the trail deliberately outlives the
-- accounts it describes — so reseeding would otherwise leave every
-- previous run's sign-ins behind. Resetting the demonstration should
-- produce the same database every time, including an empty log.
DELETE FROM audit_logs;
DELETE FROM login_attempts;
DELETE FROM privacy_consents;
DELETE FROM moderation_cases;
DELETE FROM notifications;
DELETE FROM status_logs;
DELETE FROM match_signals;
DELETE FROM match_claims;
DELETE FROM report_images;
DELETE FROM pet_reports;
DELETE FROM locations;
DELETE FROM users;

-- Breeds present in the demo data but not seeded by schema.sql.
-- INSERT IGNORE so this file stays re-runnable: schema.sql owns the first
-- twelve breeds and this seed does not delete them.
INSERT IGNORE INTO pet_breeds (breed_id, category_id, breed_name) VALUES
  (13, 1, 'Beagle'),
  (14, 1, 'German Shepherd');

-- 10 accounts: 7 community members, 2 coordinators, 1 administrator.
INSERT INTO users (user_id, full_name, email, password_hash, contact_number, role, account_status, preferred_location, created_at) VALUES
  (1, 'Maria Santos', 'maria.santos@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0101', 'user', 'active', 'Makati City, Metro Manila', '2026-03-14 02:11:00'),
  (2, 'Jomar Dela Cruz', 'jomar.delacruz@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0102', 'user', 'active', 'Quezon City, Metro Manila', '2026-04-02 07:45:00'),
  (3, 'Liza Ocampo', 'liza.ocampo@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0103', 'user', 'active', 'Makati City, Metro Manila', '2026-05-19 11:02:00'),
  (4, 'Aileen Reyes', 'aileen.reyes@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0104', 'user', 'active', 'Cebu City, Cebu', '2026-06-01 05:30:00'),
  (5, 'Kenneth Villanueva', 'kenneth.villanueva@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0105', 'user', 'active', 'Davao City, Davao del Sur', '2026-06-22 09:18:00'),
  (6, 'Noel Aguilar', 'noel.aguilar@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0106', 'user', 'active', 'Quezon City, Metro Manila', '2026-07-08 13:55:00'),
  (7, 'Rico Panganiban', 'rico.panganiban@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0107', 'user', 'suspended', 'Manila, Metro Manila', '2026-07-30 16:04:00'),
  (8, 'Patricia Lim', 'patricia.lim@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0201', 'staff', 'active', 'Metro Manila', '2026-02-10 01:00:00'),
  (9, 'Rafael Mendoza', 'rafael.mendoza@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0202', 'staff', 'active', 'Cebu City, Cebu', '2026-02-10 01:05:00'),
  (10, 'Grace Bautista', 'grace.bautista@example.com', '$2y$10$4BU4zaH7MMUYYUFucX4fLuOfnRJ81Xv3Qk67Fq5kZ6byqC1pYVRR2', '+63 917 010 0301', 'admin', 'active', 'Metro Manila', '2026-01-05 00:30:00');

-- The privacy acknowledgement each demonstration account gave when it
-- registered, dated to the account rather than to today.
INSERT INTO privacy_consents (user_id, notice_version, consented_at) VALUES
  (1, '2026-09-23', '2026-03-14 02:11:00'),
  (2, '2026-09-23', '2026-04-02 07:45:00'),
  (3, '2026-09-23', '2026-05-19 11:02:00'),
  (4, '2026-09-23', '2026-06-01 05:30:00'),
  (5, '2026-09-23', '2026-06-22 09:18:00'),
  (6, '2026-09-23', '2026-07-08 13:55:00'),
  (7, '2026-09-23', '2026-07-30 16:04:00'),
  (8, '2026-09-23', '2026-02-10 01:00:00'),
  (9, '2026-09-23', '2026-02-10 01:05:00'),
  (10, '2026-09-23', '2026-01-05 00:30:00');

-- One location per report. Coordinates are barangay-level (approximate).
INSERT INTO locations (location_id, label, city, province, latitude, longitude, `precision`) VALUES
  (1,'Near Poblacion Public Market, Barangay Poblacion', 'Makati City', 'Metro Manila', 14.5654, 121.0296, 'approximate'),
  (2,'Service road near Jupiter Street, Barangay Bel-Air', 'Makati City', 'Metro Manila', 14.5606, 121.0261, 'approximate'),
  (3,'Along Holy Spirit Drive, Barangay Holy Spirit', 'Quezon City', 'Metro Manila', 14.6829, 121.0736, 'approximate'),
  (4,'Near IBP Road, Barangay Batasan Hills', 'Quezon City', 'Metro Manila', 14.6893, 121.0925, 'approximate'),
  (5,'Near Guadalupe Elementary School, Barangay Guadalupe', 'Cebu City', 'Cebu', 10.3067, 123.8797, 'approximate'),
  (6,'Near Talomo Public Market, Barangay Talomo', 'Davao City', 'Davao del Sur', 7.0631, 125.5486, 'approximate'),
  (7,'Along Bautista Street, Barangay San Antonio', 'Makati City', 'Metro Manila', 14.5637, 121.0125, 'approximate'),
  (10,'Along Estrella Street, Barangay San Antonio', 'Makati City', 'Metro Manila', 14.5661, 121.0161, 'approximate'),
  (8,'Near the subdivision gate, Barangay Novaliches Proper', 'Quezon City', 'Metro Manila', 14.7167, 121.0333, 'approximate'),
  (11,'Near Maginhawa Street, Barangay Teachers Village East', 'Quezon City', 'Metro Manila', 14.6478, 121.0631, 'approximate'),
  (12,'Near Kalayaan Avenue, Barangay Sikatuna Village', 'Quezon City', 'Metro Manila', 14.6402, 121.0587, 'approximate'),
  (13,'Near Sanciangko Street, Barangay Kalubihan', 'Cebu City', 'Cebu', 10.2965, 123.8938, 'approximate'),
  (14,'Near Burgos Street, Barangay Villamonte', 'Bacolod City', 'Negros Occidental', 10.6714, 122.9531, 'approximate'),
  (15,'Near Iznart Street, Barangay Sampaguita', 'Iloilo City', 'Iloilo', 10.6969, 122.5644, 'approximate'),
  (16,'Near Session Road, Barangay Kayang-Hilltop', 'Baguio City', 'Benguet', 16.4119, 120.5931, 'approximate'),
  (17,'Near Limketkai Drive, Barangay Nazareth', 'Cagayan de Oro', 'Misamis Oriental', 8.4822, 124.6472, 'approximate'),
  (18,'Near McKinley Parkway, Barangay Fort Bonifacio', 'Taguig City', 'Metro Manila', 14.5486, 121.0509, 'approximate'),
  (19,'Near Rizal Avenue, Barangay Maningning', 'Puerto Princesa', 'Palawan', 9.7392, 118.7353, 'approximate'),
  (20,'Near Boni Avenue, Barangay Plainview', 'Mandaluyong City', 'Metro Manila', 14.5776, 121.0327, 'approximate'),
  (21,'Near Quimpo Boulevard, Barangay Matina Crossing', 'Davao City', 'Davao del Sur', 7.0665, 125.5932, 'approximate'),
  (22,'Near Fields Avenue, Barangay Balibago', 'Angeles City', 'Pampanga', 15.1694, 120.5906, 'approximate'),
  (23,'Near Sumulong Highway, Barangay Mayamot', 'Antipolo City', 'Rizal', 14.6116, 121.1355, 'approximate'),
  (24,'Near Governor Camins Avenue, Barangay Camino Nuevo', 'Zamboanga City', 'Zamboanga del Sur', 6.9128, 122.0761, 'approximate'),
  (9,'Barangay 659, Sampaloc', 'Manila', 'Metro Manila', 14.6091, 120.9938, 'approximate'),
  (25,'Near Quimpo Boulevard, Barangay Matina Crossing', 'Davao City', 'Davao del Sur', 7.0658, 125.5981, 'approximate'),
  (26,'Near Ecoland Drive, Barangay Talomo', 'Davao City', 'Davao del Sur', 7.0731, 125.5872, 'approximate'),
  (27,'Near Diversion Road, Barangay San Rafael', 'Iloilo City', 'Iloilo', 10.7202, 122.5621, 'approximate'),
  (28,'Near Leonard Wood Road, Barangay Lualhati', 'Baguio City', 'Benguet', 16.4118, 120.6039, 'approximate'),
  (29,'Near Lacson Street, Barangay Mandalagan', 'Bacolod City', 'Negros Occidental', 10.6785, 122.9553, 'approximate'),
  (30,'Near Kalayaan Avenue, Barangay Diliman', 'Quezon City', 'Metro Manila', 14.6488, 121.0509, 'approximate'),
  (31,'Near Salinas Drive, Barangay Lahug', 'Cebu City', 'Cebu', 10.3324, 123.8987, 'approximate'),
  (32,'Near General Luna Avenue, Barangay Ususan', 'Taguig City', 'Metro Manila', 14.5241, 121.0703, 'approximate');

-- 24 reports across both types, five species, four statuses and many regions.
INSERT INTO pet_reports (report_id, user_id, category_id, breed_id, location_id, report_type, status, pet_name, pet_size, pet_sex, primary_color, secondary_color, distinct_features, description, has_collar, pet_condition, incident_date, incident_time, allow_platform_contact, show_phone, show_email, created_at, updated_at) VALUES
  (1, 1, 1, 2, 1, 'lost', 'possible_match', 'Milo', 'small', 'male', 'Brown', 'White', 'White patch across the chest, slightly bent left ear, wears a red nylon collar with a small bell.', 'Milo slipped out of the gate while we were unloading groceries. He is friendly but nervous around traffic and usually hides under parked cars. He answers to his name and to whistling.', 'unknown', NULL, '2026-09-01', '17:30:00', TRUE, FALSE, FALSE, '2026-09-01 10:12:00', '2026-09-02 03:40:00'),
  (2, 3, 1, 2, 2, 'found', 'possible_match', NULL, 'small', 'male', 'Brown', 'Tan', 'Light patch on the chest, one ear does not stand up straight. Red collar, no name tag.', 'Found this small dog wandering along the service road early in the morning. He was calm and let me pick him up. He is safe at our house and has been fed. Looking for the owner.', 'unknown', 'Alert and responsive. Coat is dirty but no visible injuries.', '2026-09-02', '08:15:00', TRUE, FALSE, FALSE, '2026-09-02 01:02:00', '2026-09-02 03:40:00'),
  (3, 2, 2, 7, 3, 'lost', 'possible_match', 'Kitkat', 'medium', 'female', 'Orange', 'Cream', 'Orange tabby stripes, short tail with a slight kink at the tip. Spayed, no collar.', 'Kitkat is an indoor cat who got out through a window that was left open overnight. She is shy with strangers and will not come when called, but she is food-motivated.', 'unknown', NULL, '2026-07-29', '06:00:00', TRUE, TRUE, FALSE, '2026-07-29 00:22:00', '2026-07-30 12:30:00'),
  (4, 6, 2, 7, 4, 'found', 'possible_match', NULL, 'small', 'female', 'Orange', 'White', 'Orange and white, white socks on both front paws. Tail looks shorter than usual.', 'A thin orange cat has been staying near our garage for two days. She lets us leave food but will not let anyone carry her yet. Posting in case someone is looking for her.', 'unknown', 'Thin but active. Eating normally. Not yet examined by a vet.', '2026-07-30', '19:40:00', TRUE, FALSE, FALSE, '2026-07-30 12:05:00', '2026-07-30 12:30:00'),
  (5, 4, 1, 1, 5, 'lost', 'active', 'Bantay', 'large', 'male', 'Black', 'Tan', 'Tan markings above both eyes, a healed scar on the right hind leg, thick brown leather collar.', 'Bantay is our family guard dog. He went missing after the fireworks on the fiesta weekend and has not come home. He is protective of strangers at first but calms down quickly.', 'unknown', NULL, '2026-06-14', '21:00:00', TRUE, TRUE, TRUE, '2026-06-14 14:30:00', '2026-06-14 14:30:00'),
  (6, 5, 3, 11, 6, 'found', 'active', NULL, 'small', 'unknown', 'Green', 'Peach', 'Green body with a peach-coloured face. Has a small metal leg band.', 'This lovebird flew into our laundry area and did not leave. It is clearly used to people and steps onto a finger. We placed it in a spare cage. The leg band suggests it belongs to a breeder or a hobbyist.', 'unknown', 'Healthy and active. Eating seeds normally. Kept in a spare cage indoors.', '2026-06-22', '15:20:00', TRUE, FALSE, TRUE, '2026-06-22 08:14:00', '2026-06-22 08:14:00'),
  (7, 3, 2, 8, 7, 'lost', 'returned', 'Mochi', 'medium', 'female', 'White', 'Cream', 'Flat face, very long white coat, blue collar with a small silver tag.', 'Mochi was missing for five days after the door was left open during a delivery. She was found two streets away and returned by a neighbour who saw the report here.', 'unknown', NULL, '2026-05-20', '11:45:00', TRUE, FALSE, FALSE, '2026-05-20 04:50:00', '2026-05-25 07:30:00'),
  (10, 1, 2, 8, 10, 'found', 'returned', NULL, 'medium', 'female', 'White', 'Cream', 'Very long white coat, flat face, blue collar with a silver tag.', 'Found a long-haired white cat hiding under a parked van on our street. She was matted and hungry. We kept her indoors while looking for the owner.', 'unknown', 'Matted coat and hungry, otherwise healthy. Given food and water.', '2026-05-24', '09:20:00', TRUE, FALSE, FALSE, '2026-05-24 01:35:00', '2026-05-25 07:30:00'),
  (8, 2, 1, 13, 8, 'lost', 'closed', 'Coco', 'medium', 'female', 'Tricolor', 'White', 'Classic beagle tricolour, white tip on the tail, floppy ears.', 'Coco went missing near the subdivision gate. The family has since moved provinces and asked for the report to be closed.', 'unknown', NULL, '2026-04-12', '07:10:00', FALSE, FALSE, FALSE, '2026-04-12 01:40:00', '2026-05-16 09:00:00'),
  (11, 2, 1, 3, 11, 'lost', 'active', 'Nala', 'large', 'female', 'Cream', 'White', 'Pale cream coat, faint scar above the right eye, blue collar with a bone-shaped tag.', 'Nala pushed through a gap in the fence during a thunderstorm. She is gentle with children but panics at loud noises and will keep running.', 'unknown', NULL, '2026-08-03', '20:15:00', TRUE, TRUE, FALSE, '2026-08-03 13:40:00', '2026-08-03 13:40:00'),
  (12, 6, 1, 3, 12, 'found', 'active', NULL, 'large', 'female', 'Cream', 'White', 'Light-coloured big dog, small scar near one eye, blue collar, no tag.', 'A large pale dog followed my kids home from the store and would not leave. Very friendly, clearly someone''s pet. She is in our garage where it is dry.', 'unknown', 'Wet and tired but unhurt. Ate a full meal and slept.', '2026-08-12', '07:50:00', TRUE, FALSE, FALSE, '2026-08-12 00:12:00', '2026-08-12 00:12:00'),
  (13, 4, 2, 7, 13, 'lost', 'active', 'Ming', 'small', 'male', 'White', 'Grey', 'White with grey patches over both ears, one eye is pale blue.', 'Ming is barely a year old and has never been outside on his own. He was last seen on the roof of the neighbour''s extension.', 'unknown', NULL, '2026-07-05', '05:30:00', TRUE, FALSE, FALSE, '2026-07-05 02:10:00', '2026-07-05 02:10:00'),
  (14, 5, 1, 1, 14, 'lost', 'closed', 'Brownie', 'medium', 'male', 'Brown', 'White', 'Brown with a white blaze down the muzzle and white front paws.', 'Brownie disappeared from the yard overnight. The family searched for three weeks and has asked for the report to be closed.', 'unknown', NULL, '2026-04-24', '22:00:00', FALSE, FALSE, FALSE, '2026-04-24 15:05:00', '2026-05-17 01:20:00'),
  (15, 4, 2, 8, 15, 'found', 'active', NULL, 'medium', 'unknown', 'Grey', 'White', 'Very long grey coat, flat face, badly matted. No collar.', 'This cat has been sheltering under the stairs of our building for about a week. Someone must be missing it — it is clearly not a street cat.', 'unknown', 'Matted coat, underweight. Not yet seen by a vet.', '2026-08-06', '17:00:00', TRUE, FALSE, TRUE, '2026-08-06 09:30:00', '2026-08-06 09:30:00'),
  (16, 3, 4, 12, 16, 'lost', 'active', 'Bunbun', 'small', 'female', 'White', 'Brown', 'White with brown patches around both eyes and floppy ears.', 'Bunbun got out when the hutch door was left unlatched. She will not go far from cover and is most likely hiding in a garden nearby.', 'unknown', NULL, '2026-07-17', '16:20:00', TRUE, FALSE, FALSE, '2026-07-17 08:45:00', '2026-07-17 08:45:00'),
  (17, 5, 1, 4, 17, 'found', 'active', NULL, 'small', 'male', 'Tan', 'White', 'Very small, large ears, wearing a knitted red sweater.', 'Found shivering beside the highway. Someone clearly cares for this dog — the sweater looks handmade. Keeping him warm until the owner is found.', 'unknown', 'Cold and frightened at first, now settled and eating.', '2026-08-09', '06:40:00', TRUE, TRUE, FALSE, '2026-08-09 00:05:00', '2026-08-09 00:05:00'),
  (18, 1, 1, 6, 18, 'lost', 'active', 'Simba', 'large', 'male', 'Golden', NULL, 'Thick golden coat, greying muzzle, walks with a slight limp.', 'Simba is eleven years old and hard of hearing, so calling out may not reach him. He walks slowly and cannot have gone far.', 'unknown', NULL, '2026-07-11', '09:00:00', TRUE, TRUE, TRUE, '2026-07-11 02:30:00', '2026-07-11 02:30:00'),
  (19, 6, 3, 10, 19, 'found', 'active', NULL, 'small', 'unknown', 'Grey', 'Yellow', 'Grey body, yellow crest, orange cheek patches. Whistles a tune.', 'Landed on our clothesline and let my daughter pick it up straight away. It whistles the same short tune over and over, so somebody taught it.', 'unknown', 'Healthy and tame. Kept in a borrowed cage.', '2026-08-15', '11:10:00', TRUE, FALSE, TRUE, '2026-08-15 04:00:00', '2026-08-15 04:00:00'),
  (20, 3, 2, 9, 20, 'lost', 'returned', 'Miso', 'medium', 'male', 'Cream', 'Brown', 'Cream body with dark brown face, ears, paws and tail. Blue eyes.', 'Miso slipped out during a delivery. A neighbour two streets away recognised him from this report and brought him home the next morning.', 'unknown', NULL, '2026-04-18', '14:25:00', TRUE, FALSE, FALSE, '2026-04-18 06:40:00', '2026-04-19 01:15:00'),
  (21, 5, 1, 1, 21, 'found', 'active', NULL, 'medium', 'male', 'Black', 'White', 'Black with a white chest and one white back foot. Very thin.', 'Has been sleeping outside the sari-sari store for several days. Friendly with everyone, so he was somebody''s dog before this.', 'unknown', 'Thin and dusty, no visible injuries. Eating well.', '2026-08-18', '18:30:00', TRUE, FALSE, FALSE, '2026-08-18 11:00:00', '2026-08-18 11:00:00'),
  (22, 2, 1, 5, 22, 'lost', 'active', 'Cookie', 'small', 'female', 'Orange', 'Cream', 'Fluffy orange coat, recently trimmed short, pink collar with a bell.', 'Cookie was groomed two days before she went missing, so she looks much smaller and fluffier than in older photos. She barks at strangers.', 'unknown', NULL, '2026-07-24', '15:45:00', TRUE, TRUE, FALSE, '2026-07-24 08:20:00', '2026-07-24 08:20:00'),
  (23, 6, 2, 7, 23, 'found', 'returned', NULL, 'small', 'female', 'Grey', 'Black', 'Grey tabby with black stripes and a notched right ear.', 'Found crying inside a parked jeepney. The owner saw this report the same evening and collected her, notched ear and all.', 'unknown', 'Frightened but unhurt.', '2026-06-06', '19:15:00', TRUE, FALSE, FALSE, '2026-06-06 11:30:00', '2026-06-06 14:05:00'),
  (24, 4, 2, 7, 24, 'lost', 'active', 'Tabby', 'medium', 'male', 'Brown', 'Black', 'Brown tabby, very large for a puspin, missing the tip of his left ear.', 'Tabby roams the neighbourhood most days but always comes back by dinner. He has now been gone five days, which is not like him.', 'unknown', NULL, '2026-06-27', '17:00:00', TRUE, FALSE, TRUE, '2026-06-27 10:15:00', '2026-06-27 10:15:00'),
  (9, 7, 1, 14, 9, 'lost', 'closed', 'Rex', 'large', 'male', 'Black', 'Tan', 'None given.', 'Reward offered for information. Contact through the number in this description only.', 'unknown', NULL, '2026-05-08', '12:00:00', FALSE, TRUE, FALSE, '2026-05-08 05:00:00', '2026-05-09 02:20:00'),
  (25, 2, 1, 1, 25, 'lost', 'possible_match', 'Chico', 'medium', 'male', 'Brown', 'White', 'White blaze running down the muzzle, white front socks, and a kink near the end of the tail.', 'Chico slipped out when the gate was left open for a delivery. He is friendly but shy with strangers and will not come if called by someone he does not know. He answers to a whistle.', 'unknown', NULL, '2026-09-05', '16:30:00', TRUE, TRUE, FALSE, '2026-09-05 09:40:00', '2026-09-07 02:15:00'),
  (26, 6, 1, 1, 26, 'found', 'possible_match', NULL, 'medium', 'male', 'Brown', 'White', 'White stripe on the face and white paws in front. The tail bends at the tip.', 'This dog followed my tricycle home from the market and would not leave. He is well fed and clearly someone’s pet. He is staying in our yard until the owner turns up.', 'unknown', 'Healthy, well fed, no injuries. No collar.', '2026-09-07', '07:15:00', TRUE, FALSE, TRUE, '2026-09-07 01:05:00', '2026-09-07 02:15:00'),
  (27, 4, 2, 7, 27, 'lost', 'active', 'Pilo', 'small', 'male', 'Orange', 'White', 'Orange tabby with a white chest and chin. Notch in the right ear from a fight last year.', 'Pilo has never gone further than the next house. He did not come in for his evening meal and has not been seen since. He is neutered and very vocal, so he is hard to miss.', 'unknown', NULL, '2026-09-04', '18:45:00', TRUE, FALSE, TRUE, '2026-09-04 13:20:00', '2026-09-04 13:20:00'),
  (28, 7, 2, NULL, 28, 'found', 'active', NULL, 'small', 'female', 'Grey', 'White', 'Grey and white, long haired, with a very bushy tail. Wearing a thin blue collar with no tag.', 'Found sheltering under a parked jeepney during the rain. She is thin and was shivering, so we took her in and dried her off. She is eating now. The collar suggests she has an owner somewhere.', 'unknown', 'Thin and cold when found, warming up and eating well now. No injuries.', '2026-08-30', '20:10:00', TRUE, TRUE, FALSE, '2026-08-30 14:55:00', '2026-08-30 14:55:00'),
  (29, 3, 1, 13, 29, 'lost', 'active', 'Sabel', 'medium', 'female', 'Tricolour', 'White', 'Classic beagle tricolour with a white tail tip. Wears a red collar with a small brass bell.', 'Sabel followed a scent out of the subdivision gate during a walk and did not come back when called. She is food motivated and will approach anyone holding something to eat.', 'unknown', NULL, '2026-08-26', '06:00:00', TRUE, TRUE, TRUE, '2026-08-26 01:30:00', '2026-08-26 01:30:00'),
  (30, 5, 4, NULL, 30, 'found', 'active', NULL, 'small', 'unknown', 'White', 'Grey', 'White with grey ears and a grey patch over one eye. Lop eared.', 'A rabbit was hopping around the covered court in the middle of the afternoon. Someone caught it before a dog did. It is in a borrowed cage at the barangay hall with food and water.', 'unknown', 'Alert and eating. No visible injuries.', '2026-09-06', '15:00:00', TRUE, FALSE, FALSE, '2026-09-06 08:05:00', '2026-09-06 08:05:00'),
  (31, 1, 2, 8, 31, 'lost', 'active', 'Tuna', 'medium', 'female', 'Cream', NULL, 'Flat face, very thick cream coat, and one eye that waters constantly. Recently shaved along her back for a skin treatment.', 'Tuna is an indoor cat and got out through a window screen that had come loose. She is not used to the outside and will most likely be hiding somewhere close rather than roaming far.', 'unknown', NULL, '2026-08-22', '11:20:00', TRUE, FALSE, TRUE, '2026-08-22 05:45:00', '2026-08-22 05:45:00'),
  (32, 2, 1, 2, 32, 'found', 'active', NULL, 'small', 'unknown', 'White', 'Grey', 'Small white and grey shih tzu, badly matted coat, nails long enough that it has been loose a while.', 'Wandering along the service road near the market, going up to people for food. The coat is matted and the nails are long, so it has probably been out for some time rather than lost today.', 'unknown', 'Underweight with a matted coat. Nervous but not aggressive. Needs a groomer and a vet check.', '2026-09-08', '09:30:00', TRUE, FALSE, TRUE, '2026-09-08 03:10:00', '2026-09-08 03:10:00');

-- 33 photographs. report-009 has none: the scam report was filed
-- without one, which is part of why it was flagged.
INSERT INTO report_images (report_id, image_path, alt_text, is_primary_photo) VALUES
  (1, 'pet-001-milo-1.jpg', 'Small brown Shih Tzu with a white chest patch, sitting on a tiled floor', TRUE),
  (1, 'pet-001-milo-2.jpg', 'Close-up of the same brown Shih Tzu showing his slightly bent left ear', FALSE),
  (2, 'pet-002-dog.jpg', 'Small brown Shih Tzu with a red collar, photographed on a doormat', TRUE),
  (3, 'pet-003-kitkat.jpg', 'Orange tabby cat with a short kinked tail, resting on a windowsill', TRUE),
  (4, 'pet-004-cat.jpg', 'Thin orange and white cat sitting beside a garage door at night', TRUE),
  (5, 'pet-005-bantay.jpg', 'Large black and tan native dog standing in a yard', TRUE),
  (6, 'pet-006-bird.jpg', 'Green lovebird with a peach-coloured face perched inside a wire cage', TRUE),
  (7, 'pet-007-mochi.jpg', 'Long-haired white Persian cat wearing a blue collar', TRUE),
  (10, 'pet-010-cat.jpg', 'Long-haired white cat with a matted coat sitting on a folded towel', TRUE),
  (8, 'pet-008-coco.jpg', 'Tricolour beagle with floppy ears sitting on grass', TRUE),
  (11, 'pet-011-nala.jpg', 'Large cream-coloured Labrador wearing a blue collar', TRUE),
  (12, 'pet-012-dog.jpg', 'Cream-coloured Labrador lying on a blanket in a garage', TRUE),
  (13, 'pet-013-ming.jpg', 'Young white and grey cat with one pale blue eye', TRUE),
  (14, 'pet-014-brownie.jpg', 'Brown native dog with a white blaze on its muzzle', TRUE),
  (15, 'pet-015-cat.jpg', 'Long-haired grey Persian cat with a matted coat', TRUE),
  (16, 'pet-016-bunbun.jpg', 'White lop-eared rabbit with brown patches around its eyes', TRUE),
  (17, 'pet-017-dog.jpg', 'Small tan Chihuahua wearing a knitted red sweater', TRUE),
  (18, 'pet-018-simba.jpg', 'Elderly golden retriever with a greying muzzle', TRUE),
  (19, 'pet-019-bird.jpg', 'Grey cockatiel with a yellow crest and orange cheek patches', TRUE),
  (20, 'pet-020-miso.jpg', 'Siamese cat with a cream body and dark brown face', TRUE),
  (21, 'pet-021-dog.jpg', 'Thin black native dog with a white chest', TRUE),
  (22, 'pet-022-cookie.jpg', 'Small fluffy orange Pomeranian with a pink collar', TRUE),
  (23, 'pet-023-cat.jpg', 'Grey tabby cat with a notched right ear', TRUE),
  (24, 'pet-024-tabby.jpg', 'Large brown tabby cat with a missing left ear tip', TRUE),
  (9, 'pet-009-rex.png', 'Large black and tan dog with upright ears and a long muzzle, lying on a concrete driveway beside potted plants', TRUE),
  (25, 'pet-025-chico.png', 'Brown Aspin with a white blaze down the muzzle, a white chest and white front socks, standing in a concrete alley beside potted plants', TRUE),
  (26, 'pet-026-dog.png', 'Brown and white Aspin seen from its left side on a residential street, with a white face stripe, white paws and a curled tail', TRUE),
  (27, 'pet-027-pilo.png', 'Orange tabby cat with a white chin, chest and front paws, sitting on a concrete step beside a potted plant', TRUE),
  (28, 'pet-028-cat.png', 'Long-haired grey and white cat wearing a blue collar, standing on a concrete path with its bushy tail raised', TRUE),
  (29, 'pet-029-sabel.png', 'Tricolour beagle with a white-tipped tail, wearing a red collar with a small brass bell, standing on grass', TRUE),
  (30, 'pet-030-rabbit.png', 'White lop-eared rabbit with grey ears and a grey patch over one eye, sitting inside a wire cage', TRUE),
  (31, 'pet-031-tuna.png', 'Cream Persian cat with a flat face and a thick ruff, its body coat clipped short, sitting on a concrete floor', TRUE),
  (32, 'pet-032-dog.png', 'Small white and grey shih tzu with a badly matted coat, standing on a damp concrete path', TRUE);

-- Possible pairings, with the score the matching algorithm produced.
INSERT INTO match_claims (match_id, lost_report_id, found_report_id, submitted_by_user_id, reviewed_by_user_id, match_score, match_status, proof_notes, staff_notes, created_at, updated_at) VALUES
  (1, 1, 2, NULL, 8, 85, 'verification_requested', NULL, 'Owner was asked to describe the collar tag and the bent ear before any contact details are shared. Awaiting reply.', '2026-09-02 03:40:00', '2026-09-03 01:15:00'),
  (2, 3, 4, NULL, NULL, 75, 'suggested', NULL, NULL, '2026-07-30 12:30:00', '2026-07-30 12:30:00'),
  (3, 7, 10, NULL, 9, 100, 'confirmed', NULL, 'Owner correctly described the engraving on the collar tag and provided an earlier photo. Handover completed at the barangay hall.', '2026-05-24 02:15:00', '2026-05-25 07:30:00'),
  (4, 25, 26, NULL, NULL, 100, 'suggested', NULL, NULL, '2026-09-07 02:15:00', '2026-09-07 02:15:00');

-- Why each match scored what it scored — one row per compared characteristic.
-- This is what makes the matching explainable rather than a black box.
INSERT INTO match_signals (match_id, signal_key, is_matched, weight, detail) VALUES
  (1, 'species', TRUE, 25, 'Both reports describe a dog.'),
  (1, 'location', TRUE, 20, 'Both locations are in Makati City, roughly 1 km apart.'),
  (1, 'breed', TRUE, 15, 'Both reports say Shih Tzu.'),
  (1, 'color', FALSE, 15, 'Primary colour matches (brown), but the secondary colour differs: white vs tan.'),
  (1, 'size', TRUE, 10, 'Both reports say small.'),
  (1, 'date', TRUE, 10, 'Found one day after the pet was reported lost.'),
  (1, 'characteristics', TRUE, 5, 'Both mention a chest patch, an ear that does not stand up, and a red collar.'),
  (2, 'species', TRUE, 25, 'Both reports describe a cat.'),
  (2, 'location', TRUE, 20, 'Both locations are in Quezon City, roughly 2 km apart.'),
  (2, 'breed', TRUE, 15, 'Both reports say Puspin (Philippine Domestic Shorthair).'),
  (2, 'color', FALSE, 15, 'Primary colour matches (orange), but the secondary colour differs: cream vs white.'),
  (2, 'size', FALSE, 10, 'The lost report says medium; the found report says small.'),
  (2, 'date', TRUE, 10, 'Found one day after the pet was reported lost.'),
  (2, 'characteristics', TRUE, 5, 'Both reports describe an unusually short tail.'),
  (3, 'species', TRUE, 25, 'Both reports describe a cat.'),
  (3, 'location', TRUE, 20, 'Both locations are in Barangay San Antonio, Makati City.'),
  (3, 'breed', TRUE, 15, 'Both reports say Persian.'),
  (3, 'color', TRUE, 15, 'Both reports say white with cream.'),
  (3, 'size', TRUE, 10, 'Both reports say medium.'),
  (3, 'date', TRUE, 10, 'Found four days after the pet was reported lost.'),
  (3, 'characteristics', TRUE, 5, 'Both mention a long white coat, a flat face, and a blue collar with a silver tag.'),
  (4, 'species', TRUE, 25, 'Both reports describe a dog.'),
  (4, 'location', TRUE, 20, 'Matina Crossing and Talomo are adjacent barangays in Davao City, about 2 km apart.'),
  (4, 'breed', TRUE, 15, 'Both reports say Aspin.'),
  (4, 'color', TRUE, 15, 'Both reports say brown with white.'),
  (4, 'size', TRUE, 10, 'Both reports say medium.'),
  (4, 'date', TRUE, 10, 'Found two days after the pet was reported lost.'),
  (4, 'characteristics', TRUE, 5, 'Both mention: white, tail.');

-- Case history. Appended to, never overwritten, so a case stays auditable.
INSERT INTO status_logs (report_id, updated_by_user_id, previous_status, new_status, note, created_at) VALUES
  (1, 1, NULL, 'active', 'Report created.', '2026-09-01 10:12:00'),
  (1, 8, 'active', 'possible_match', 'A found report with similar characteristics was identified.', '2026-09-02 03:40:00'),
  (2, 3, NULL, 'active', 'Report created.', '2026-09-02 01:02:00'),
  (2, 8, 'active', 'possible_match', 'Linked to a lost report with similar characteristics.', '2026-09-02 03:40:00'),
  (3, 2, NULL, 'active', 'Report created.', '2026-07-29 00:22:00'),
  (3, NULL, 'active', 'possible_match', 'A possible match was found.', '2026-07-30 12:30:00'),
  (4, 6, NULL, 'active', 'Report created.', '2026-07-30 12:05:00'),
  (4, NULL, 'active', 'possible_match', 'A possible match was found.', '2026-07-30 12:30:00'),
  (5, 4, NULL, 'active', 'Report created.', '2026-06-14 14:30:00'),
  (6, 5, NULL, 'active', 'Report created.', '2026-06-22 08:14:00'),
  (7, 3, NULL, 'active', 'Report created.', '2026-05-20 04:50:00'),
  (7, 9, 'active', 'possible_match', 'A neighbour submitted a found report with matching characteristics.', '2026-05-24 02:15:00'),
  (7, 9, 'possible_match', 'returned', 'Ownership verified by the Pet Coordinator. Pet returned to the owner.', '2026-05-25 07:30:00'),
  (10, 1, NULL, 'active', 'Report created.', '2026-05-24 01:35:00'),
  (10, 9, 'active', 'possible_match', 'Linked to a lost report filed four days earlier.', '2026-05-24 02:15:00'),
  (10, 9, 'possible_match', 'returned', 'Ownership verified by the Pet Coordinator. Pet returned to the owner.', '2026-05-25 07:30:00'),
  (8, 2, NULL, 'active', 'Report created.', '2026-04-12 01:40:00'),
  (8, 2, 'active', 'closed', 'Closed at the reporter’s request.', '2026-05-16 09:00:00'),
  (11, 2, NULL, 'active', 'Report created.', '2026-08-03 13:40:00'),
  (12, 6, NULL, 'active', 'Report created.', '2026-08-12 00:12:00'),
  (13, 4, NULL, 'active', 'Report created.', '2026-07-05 02:10:00'),
  (14, 5, NULL, 'active', 'Report created.', '2026-04-24 15:05:00'),
  (14, 5, 'active', 'closed', 'Closed at the reporter''s request.', '2026-05-17 01:20:00'),
  (15, 4, NULL, 'active', 'Report created.', '2026-08-06 09:30:00'),
  (16, 3, NULL, 'active', 'Report created.', '2026-07-17 08:45:00'),
  (17, 5, NULL, 'active', 'Report created.', '2026-08-09 00:05:00'),
  (18, 1, NULL, 'active', 'Report created.', '2026-07-11 02:30:00'),
  (19, 6, NULL, 'active', 'Report created.', '2026-08-15 04:00:00'),
  (20, 3, NULL, 'active', 'Report created.', '2026-04-18 06:40:00'),
  (20, 3, 'active', 'returned', 'Returned by a neighbour who recognised him from the report.', '2026-04-19 01:15:00'),
  (21, 5, NULL, 'active', 'Report created.', '2026-08-18 11:00:00'),
  (22, 2, NULL, 'active', 'Report created.', '2026-07-24 08:20:00'),
  (23, 6, NULL, 'active', 'Report created.', '2026-06-06 11:30:00'),
  (23, 6, 'active', 'returned', 'Owner recognised the notched ear and collected her the same evening.', '2026-06-06 14:05:00'),
  (24, 4, NULL, 'active', 'Report created.', '2026-06-27 10:15:00'),
  (9, 7, NULL, 'active', 'Report created.', '2026-05-08 05:00:00'),
  (9, 10, 'active', 'closed', 'Removed by an administrator following a moderation review.', '2026-05-09 02:20:00'),
  (25, 2, NULL, 'active', 'Report created.', '2026-09-05 09:40:00'),
  (25, NULL, 'active', 'possible_match', 'A found report filed nearby shares the species, breed and markings.', '2026-09-07 02:15:00'),
  (26, 6, NULL, 'active', 'Report created.', '2026-09-07 01:05:00'),
  (26, NULL, 'active', 'possible_match', 'A lost report filed two days earlier describes the same markings.', '2026-09-07 02:15:00'),
  (27, 4, NULL, 'active', 'Report created.', '2026-09-04 13:20:00'),
  (28, 7, NULL, 'active', 'Report created.', '2026-08-30 14:55:00'),
  (29, 3, NULL, 'active', 'Report created.', '2026-08-26 01:30:00'),
  (30, 5, NULL, 'active', 'Report created.', '2026-09-06 08:05:00'),
  (31, 1, NULL, 'active', 'Report created.', '2026-08-22 05:45:00'),
  (32, 2, NULL, 'active', 'Report created.', '2026-09-08 03:10:00');

-- Notifications for members and coordinators.
INSERT INTO notifications (user_id, notification_type, title, body, report_id, match_id, is_read, created_at) VALUES
  (1, 'match_suggested', 'Possible match found for Milo', 'A found dog reported in Barangay Bel-Air shares several characteristics with your report.', 1, 1, FALSE, '2026-09-02 03:41:00'),
  (1, 'verification_requested', 'Verification requested', 'A Pet Coordinator asked you to describe two details about Milo before contact information is shared.', 1, 1, FALSE, '2026-09-03 01:15:00'),
  (3, 'staff_reviewed', 'Your found report was reviewed', 'A Pet Coordinator reviewed your found report and linked it to a possible match.', 2, 1, TRUE, '2026-09-02 03:42:00'),
  (2, 'match_suggested', 'Possible match found for Kitkat', 'A found cat reported in Barangay Batasan Hills shares several characteristics with your report.', 3, 2, FALSE, '2026-07-30 12:31:00'),
  (3, 'pet_returned', 'Mochi has been marked as returned', 'Your report was closed as a successful reunion. Thank you for updating the community.', 7, 3, TRUE, '2026-05-25 07:31:00'),
  (1, 'match_confirmed', 'Match confirmed — thank you', 'The cat you found was verified as Mochi and has been returned to her owner.', 10, 3, TRUE, '2026-05-25 07:32:00'),
  (2, 'status_changed', 'Report for Coco was closed', 'Your lost report was closed at your request. You can reopen it by filing a new report.', 8, NULL, TRUE, '2026-05-16 09:01:00'),
  (4, 'report_updated', 'Your report is still active', 'No possible matches have been identified for Bantay yet. Adding a clearer photo can help.', 5, NULL, FALSE, '2026-06-22 00:00:00'),
  (8, 'verification_requested', 'Verification requested on the Milo pairing', 'The owner asked for the 85% pairing between a lost Shih Tzu and a found dog in Makati City to be checked.', 1, 1, FALSE, '2026-09-03 01:16:00'),
  (8, 'match_suggested', 'A possible match has no coordinator yet', 'The 75% pairing raised for Kitkat in Quezon City has not been picked up by anyone.', 3, 2, FALSE, '2026-07-30 12:32:00'),
  (8, 'report_updated', 'An active report has had no matches for a week', 'Bantay in Cebu City is still active with nothing suggested. It may be worth asking the owner for a clearer photo.', 5, NULL, TRUE, '2026-06-22 00:05:00');

-- Community flags for an administrator to decide on.
INSERT INTO moderation_cases (report_id, reported_by_user_id, reason, details, case_status, resolved_by_admin_id, resolution_note, created_at) VALUES
  (9, 2, 'scam', 'No photo, no distinguishing details, and the description pushes people to call a number directly instead of using the platform. Looks like a reward scam.', 'actioned', 10, 'Report removed and the account suspended pending review.', '2026-05-08 22:10:00'),
  (6, 6, 'duplicate', 'I think this same lovebird was already posted last week by someone else.', 'open', NULL, NULL, '2026-06-26 03:25:00');
