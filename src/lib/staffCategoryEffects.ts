/**
 * staffCategoryEffects.ts
 *
 * Static configuration of staff category effects. Pure data file meant to be
 * imported by UI components to show skills & bonuses per staff category.
 */

/**
 * StaffCategory
 *
 * Supported staff categories used across the staff UI.
 */
export type StaffCategory =
  | 'drivers'
  | 'mechanics'
  | 'dispatchers'
  | 'managers'
  | 'directors'

/**
 * CategoryEffectBlock
 *
 * A single block of effects for a staff category containing a title,
 * description and bullet points.
 */
export interface CategoryEffectBlock {
  title: string
  description: string
  bullets: string[]
}

/**
 * STAFF_CATEGORY_EFFECTS
 *
 * Declarative mapping of StaffCategory -> CategoryEffectBlock[] used by the
 * StaffCategoryEffects component.
 */
export const STAFF_CATEGORY_EFFECTS: Record<StaffCategory, CategoryEffectBlock[]> = {
  drivers: [
    {
      title: 'Driving Skills',
      description: 'Individual driver skills affect only the assigned truck.',
      bullets: [
        'Long Haul - Bonuse per route: 8% reliability, 6% fuel efficiency, 5% speed bonus',
        'ADR Certified - Allows driver to transport Hazardous Materials, Industrial/Chemical Liquids, and Corrosive Chemicals. Without this skill, these cargo types are locked.',
        'Oversized Loads - Allows driver to transport Extra Long Loads and Heavy Machinery / Oversized cargo. Without this skill, these cargo types are locked.',
        'International Routes - Reduces customs processing time by 15% and gives a small 5% speed bonus on international routes.',
        'Night Driving - During night driving only: +10% speed and +10% fuel efficiency. Especially effective when using two drivers per truck.',
        'City Navigation - On Local and State job offers only: +15% speed and up to 5% shorter routes due to better city navigation.',
        'Eco Driving - More economical driving style: +10% fuel efficiency on all routes.',
        'Careful Driver - Safer but slower driver: -15% accident chance, -20% cargo damage chance, but drives 10% slower than average.',
        'Express Delivery - Fast but risky: +15% speed, but +10% accident chance and +10% cargo damage chance.',
      ],
    },
  ],

  mechanics: [
    {
      title: 'Mechanical Expertise',
      description: 'Mechanic skills reduce downtime and maintenance costs.',
      bullets: [
        'Powertrain Specialist - 20% faster and 10% cheaper repairs on engine, transmission, clutch assembly, and fuel system.',
        'Chassis & Control Systems Specialist - 15% faster and 10% cheaper repairs on suspension, steering components, and brakes.',
        'Electrical & Thermal Systems Specialist - 15% faster and 10% cheaper repairs on battery, alternator, radiator, and cooling system.',
        'Wear & Consumables Expert - 25% faster and 15% cheaper repairs on tires and exhaust system.',
        'Trailer Structural Systems Specialist - 15% faster and 15% cheaper repairs on trailer axles and suspension system.',
        'Trailer Mobility & Braking Specialist - 20% faster and 10% cheaper repairs on trailer wheels, tires, and braking system.',
      ],
    },
  ],

  dispatchers: [
    {
      title: 'Route Optimization',
      description: 'Dispatcher effects apply to all active jobs.',
      bullets: [
        'Schedule Coordination - 5% Pickup, Loading and Unloading Phases speed bonus.',
        'Route Optimization - 5% Driving and Relocation Phases speed bonus.',
        'Border & Checkpoint Management - 15% Border crossing and Customs checkpoint Phases speed bonus.',
        'Real-Time Issue Resolution Specialist - 10% Incident resolution cost reduction and 20% Incident resolution time reduction.',
      ],
    },
  ],

  managers: [
    {
      title: 'Manager Positions',
      description: 'Only ONE manager per position. Effects are global.',
      bullets: [
        'Expansion Manager - 10% Expansion cost reduction and 10% Garage upgrade time reduction.',
        'Staff Manager - 20% Training speed bonus and 15% Fatigue recovery bonus.',
        'Operations Manager - 5% Fuel cost reduction and 5% Global job phase time reduction.',
        'Performance Analytics Manager - 2% Completed job income bonus.',
        'HR Manager - 10% Happiness gain bonus and 20% Quit chance reduction.',
        'Fleet Manager - 5% Driving speed bonus and 10% Repair downtime reduction.',
        'Financial Manager - 5% Salary cost reduction, 10% Loan interest reduction and 5% Operational cost reduction.',
        'Customer Relations Manager - 0,05% Reputation bonus on completed job and 0,05% Late delivery penalty reputation bonus.',
        'Maintenance Manager - 5% Repair time reduction and 5% Maintenance cost reductions.',
        'Logistics Manager - 10% Warehouse staff salary reduction and 5% Warehouse maintenance cost reduction.',
        'Risk & Compliance Manager - 25% Fine reduction and 10% Accident chance reduction.',
      ],
    },
  ],

  directors: [
    {
      title: 'Executive Leadership',
      description: 'Directors provide company-wide strategic bonuses.',
      bullets: [
        'CTO – Chief Technology Officer - 25% Boost of Expansion Manager, Maintenance Manager and Fleet Manager position bonuses. ',
        'CSO – Chief Strategy Officer - 30% Boost of Customer Relations Manager and Logistics Mnaager position bonuses.',
        'CFO – Chief Financial Officer - 30% Boost of Performance Analytics Manager and Financial Manager position bonuses.',
        'COO – Chief Operating Officer - 25% Boost of Staff Manager, Operations Manager and HR Manager position bonuses.',
      ],
    },
  ],
}
