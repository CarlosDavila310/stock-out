// PROTOTYPE - NOT FOR PRODUCTION
// Question: ¿Repartirse el trabajo de una tienda 24 horas en un turno de 4 minutos se siente caótico, gracioso y de equipo?
// Date: 2026-11-13
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // The shift and its waves (seconds from the start of the shift)
  shift_length: { value: 240, min: 60, max: 600, step: 10 },  // s, the whole shift
  tutorial_end: { value: 60, min: 20, max: 120, step: 5 },     // s, the minute that teaches by playing
  rush_start: { value: 120, min: 60, max: 300, step: 5 },      // s, rush hour begins
  rush_end: { value: 180, min: 90, max: 400, step: 5 },        // s, the breather begins
  crunch_delay: { value: 6, min: 0, max: 40, step: 1 },        // s after the tutorial: the first real crunch
  spawn_apuro: { value: 6.5, min: 2, max: 20, step: 0.5 },     // s between customers, minute 1-2
  spawn_punta: { value: 3.2, min: 1, max: 12, step: 0.1 },     // s between customers, rush hour
  spawn_respiro: { value: 9, min: 2, max: 30, step: 0.5 },     // s between customers, breather
  hungry_apuro: { value: 0.3, min: 0, max: 1, step: 0.05 },    // share of customers who order hot food
  hungry_punta: { value: 0.4, min: 0, max: 1, step: 0.05 },
  hungry_respiro: { value: 0.25, min: 0, max: 1, step: 0.05 },
  max_customers: { value: 14, min: 4, max: 30, step: 1 },      // customers in the store at once

  // Difficulty. Intermedio is every value in this file as it stands (the shift you played);
  // Fácil and Difícil multiply a few of them, and set their own crowd size and star goals.
  easy_spawn: { value: 1.35, min: 0.5, max: 3, step: 0.05 },     // times the gap between customers
  easy_patience: { value: 1.35, min: 0.5, max: 3, step: 0.05 },  // times every customer's patience
  easy_burn: { value: 1.5, min: 0.5, max: 3, step: 0.05 },       // times the seconds before food burns
  easy_spill: { value: 0.6, min: 0, max: 3, step: 0.05 },        // times the spill chance
  easy_penalty: { value: 0.7, min: 0, max: 3, step: 0.05 },      // times every satisfaction loss
  easy_max_customers: { value: 11, min: 4, max: 30, step: 1 },
  easy_star2: { value: 110, min: 10, max: 1000, step: 10 },      // S/ for two stars on Fácil
  easy_star3: { value: 160, min: 10, max: 1000, step: 5 },
  hard_spawn: { value: 0.78, min: 0.3, max: 2, step: 0.02 },
  hard_patience: { value: 0.8, min: 0.3, max: 2, step: 0.05 },
  hard_burn: { value: 0.7, min: 0.3, max: 2, step: 0.05 },
  hard_spill: { value: 1.5, min: 0, max: 4, step: 0.05 },
  hard_penalty: { value: 1.25, min: 0, max: 4, step: 0.05 },
  hard_max_customers: { value: 17, min: 4, max: 30, step: 1 },
  hard_star2: { value: 190, min: 10, max: 1000, step: 10 },      // S/ for two stars on Difícil
  hard_star3: { value: 270, min: 10, max: 1000, step: 5 },

  // How it reads on screen
  figure_scale: { value: 1.3, min: 0.8, max: 2, step: 0.05 },  // characters drawn this much bigger (collisions unchanged)
  product_scale: { value: 2.0, min: 1, max: 3, step: 0.1 },    // products on the shelves
  item_scale: { value: 1.2, min: 0.8, max: 2, step: 0.05 },    // boxes, food, the bag
  camera_tilt: { value: 50, min: 35, max: 75, step: 1 },       // degrees down from level

  // Moving and bumping
  walk_speed: { value: 4.4, min: 2, max: 8, step: 0.1 },       // tiles/s
  accel: { value: 22, min: 4, max: 60, step: 1 },              // how fast walking reaches its speed (1/s)
  bot_speed: { value: 0.86, min: 0.5, max: 1.2, step: 0.02 },  // bot walking speed, times walk_speed
  bot_think: { value: 0.35, min: 0.1, max: 1.5, step: 0.05 },  // s between the bot's decisions
  bot_tutorial_wait: { value: 6, min: 0, max: 20, step: 1 },   // s the bot leaves a new job to you in the first minute
  bump_speed: { value: 5.0, min: 2, max: 10, step: 0.25 },     // closing speed (tiles/s) that makes a bump
  bump_push: { value: 4.5, min: 0, max: 10, step: 0.25 },      // knockback speed (tiles/s)
  bump_stun: { value: 0.35, min: 0, max: 1.5, step: 0.05 },    // s without control after a bump
  bump_drop: { value: 1, min: 0, max: 1, step: 0.05 },         // chance a bump knocks the carried thing out
  slip_time: { value: 1.3, min: 0.3, max: 4, step: 0.1 },      // s on the floor after slipping
  slip_immune: { value: 1.5, min: 0, max: 4, step: 0.1 },      // s after getting up with no new slip
  slip_min_speed: { value: 1.2, min: 0, max: 4, step: 0.1 },   // tiles/s: slower than this walks over a spill
  customer_slip_chance: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // Work (seconds holding the work key)
  restock_time: { value: 1.2, min: 0.2, max: 5, step: 0.1 },
  checkout_time: { value: 1.3, min: 0.2, max: 5, step: 0.1 },
  checkout_per_item: { value: 0.25, min: 0, max: 2, step: 0.05 },
  mop_time: { value: 1.5, min: 0.2, max: 5, step: 0.1 },
  cook_time: { value: 6, min: 1, max: 20, step: 0.5 },         // s in the oven until ready
  burn_time: { value: 5, min: 1, max: 20, step: 0.5 },         // s more until it burns
  take_time: { value: 0.6, min: 0.1, max: 3, step: 0.1 },      // s a customer takes to pick a product

  // Stock
  shelf_cap: { value: 6, min: 2, max: 12, step: 1 },           // products per shelf when full
  fridge_cap: { value: 8, min: 2, max: 16, step: 1 },          // drinks when the fridge is full
  start_snacks: { value: 1, min: 0, max: 12, step: 1 },        // the first lesson: the snacks run out
  start_galletas: { value: 3, min: 0, max: 12, step: 1 },
  start_abarrotes: { value: 3, min: 0, max: 12, step: 1 },
  start_bebidas: { value: 4, min: 0, max: 16, step: 1 },
  empty_wait: { value: 4, min: 0, max: 15, step: 0.5 },        // s a customer waits at an empty shelf
  display_cap: { value: 4, min: 1, max: 8, step: 1 },          // each food in the cold display when full
  display_start: { value: 3, min: 0, max: 8, step: 1 },        // each food in it when the shift starts

  // Customers' patience (s waiting in the queue or for hot food)
  patience_escolar: { value: 24, min: 5, max: 90, step: 1 },
  patience_abuelita: { value: 48, min: 5, max: 120, step: 1 },
  patience_oficinista: { value: 40, min: 5, max: 120, step: 1 },
  patience_obrero: { value: 46, min: 5, max: 120, step: 1 },
  patience_deportista: { value: 20, min: 5, max: 90, step: 1 },
  tutorial_patience: { value: 2.5, min: 1, max: 5, step: 0.1 }, // patience multiplier in the first minute

  // Customers' walking speed (tiles/s)
  speed_escolar: { value: 2.4, min: 0.5, max: 6, step: 0.1 },
  speed_abuelita: { value: 1.5, min: 0.5, max: 6, step: 0.1 },
  speed_oficinista: { value: 2.5, min: 0.5, max: 6, step: 0.1 },
  speed_obrero: { value: 2.1, min: 0.5, max: 6, step: 0.1 },
  speed_deportista: { value: 3.0, min: 0.5, max: 6, step: 0.1 },

  // Mess
  spill_chance: { value: 0.2, min: 0, max: 1, step: 0.02 },    // chance a customer with a drink spills it
  spill_punta_mult: { value: 1.8, min: 1, max: 4, step: 0.1 }, // more spills in rush hour
  max_spills: { value: 4, min: 1, max: 10, step: 1 },
  bin_cap: { value: 8, min: 2, max: 20, step: 1 },             // wrappers until the bin is full
  litter_chance: { value: 0.5, min: 0, max: 1, step: 0.05 },   // chance a paying customer throws a wrapper away

  // Store satisfaction (0-100)
  sat_start: { value: 100, min: 10, max: 100, step: 5 },
  angry_penalty: { value: 12, min: 0, max: 50, step: 1 },      // per customer who leaves annoyed
  empty_grace: { value: 6, min: 0, max: 30, step: 1 },         // s a shelf can be empty for free
  empty_drain: { value: 0.7, min: 0, max: 5, step: 0.1 },      // per second, per empty shelf
  spill_grace: { value: 8, min: 0, max: 30, step: 1 },         // s a spill can wait for free
  spill_drain: { value: 0.5, min: 0, max: 5, step: 0.1 },      // per second, per spill
  happy_bonus: { value: 1.5, min: 0, max: 10, step: 0.5 },     // per customer served
  tutorial_drain: { value: 0.3, min: 0, max: 1, step: 0.05 },  // drain multiplier in the first minute

  // Money (soles) and stars
  price_snacks: { value: 2.5, min: 0.5, max: 20, step: 0.1 },
  price_galletas: { value: 1.8, min: 0.5, max: 20, step: 0.1 },
  price_abarrotes: { value: 4.2, min: 0.5, max: 20, step: 0.1 },
  price_bebidas: { value: 3.5, min: 0.5, max: 20, step: 0.1 },
  price_empanada: { value: 6, min: 0.5, max: 30, step: 0.5 },
  price_hamburguesa: { value: 8, min: 0.5, max: 30, step: 0.5 },
  price_postre: { value: 5, min: 0.5, max: 30, step: 0.5 },
  task_reward: { value: 1, min: 0, max: 10, step: 0.5 },       // per restock, mop or bag
  star2: { value: 150, min: 10, max: 1000, step: 10 },         // S/ for two stars (finishing gives one)
  star3: { value: 215, min: 10, max: 1000, step: 5 },          // S/ for three stars

  // Online play (up to 4 players)
  online_crowd_gain: { value: 0.3, min: 0, max: 1, step: 0.05 }, // each worker beyond two: this much more crowd (customers come sooner, stars cost more)
  net_snapshot_hz: { value: 20, min: 5, max: 60, step: 5 },    // snapshots per second the host sends
  net_input_hz: { value: 30, min: 5, max: 60, step: 5 },       // position and key reports per second a client sends
  net_smooth: { value: 16, min: 2, max: 60, step: 1 },         // how fast other players and customers glide to their latest spot (1/s)
  net_snap_dist: { value: 1.2, min: 0.3, max: 4, step: 0.1 },  // tiles: farther than this, a figure jumps instead of gliding
  net_timeout: { value: 8, min: 3, max: 30, step: 1 },         // s of silence before a player is dropped
  net_join_timeout: { value: 12, min: 4, max: 40, step: 1 },   // s to wait for a room before giving up
};
