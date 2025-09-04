# Battalion Wars Discord Bot - Visual Flow Diagrams

## System Connection Flow Diagram

```
                    ┌─────────────────────────────┐
                    │         INDEX.JS            │
                    │    (Bootstrap & Config)     │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │      Discord Client         │
                    │     (Event Dispatcher)      │
                    └─────────────┬───────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│    READY    │          │  MESSAGE    │          │ INTERACTION │
│   HANDLER   │          │  HANDLERS   │          │   HANDLER   │
└─────┬───────┘          └─────┬───────┘          └─────┬───────┘
      │                        │                        │
      ▼                        ▼                        ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│ Command     │          │ DM/Modmail  │          │ Slash Cmds  │
│ Registration│          │ Processing  │          │ & Buttons   │
└─────────────┘          └─────┬───────┘          └─────┬───────┘
                               │                        │
                               ▼                        ▼
                      ┌─────────────┐          ┌─────────────┐
                      │ Verification│          │ Mission     │
                      │ Workflow    │          │ Selection   │
                      └─────────────┘          └─────────────┘

        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│ GUILD MEMBER│          │ GUILD MEMBER│          │ ERROR       │
│ ADD HANDLER │          │ UPD HANDLER │          │ HANDLERS    │
└─────┬───────┘          └─────┬───────┘          └─────────────┘
      │                        │
      ▼                        ▼
┌─────────────┐          ┌─────────────┐
│ Auto-Verify │          │ Lang Role   │
│ Logic       │          │ Sync        │
└─────┬───────┘          └─────┬───────┘
      │                        │
      └────────┬─────────────────┘
               ▼
      ┌─────────────┐
      │  LANG ROLES │
      │   MODULE    │
      └─────────────┘
```

## Event Flow Cascade Diagram

```
USER ACTION TRIGGERS
│
├── NEW MEMBER JOINS
│   │
│   ├── Account Age < 90 days?
│   │   ├── YES ──── Invite Check
│   │   │            ├── Via Invite ──── Normal Flow
│   │   │            └── No Invite ───── Force Unverified
│   │   └── NO ─────── Normal Flow
│   │
│   └── Auto-Verify Enabled?
│       ├── YES ──── Add Verified Role
│       └── NO ───── Add Unverified Role
│
├── SENDS DM TO BOT
│   │
│   ├── Has Unverified Role?
│   │   ├── YES ──── Create/Find Modmail Channel
│   │   │            ├── Send Verification Embed
│   │   │            └── Relay Message to Mods
│   │   └── NO ───── Send Error Message
│   │
│   └── MODERATOR RESPONDS
│       └── Relay to User
│
├── USES SLASH COMMAND
│   │
│   ├── /ping ─────────── Return Latency
│   ├── /membercount ──── Display Server Stats
│   ├── /toggleverification ── Admin Only
│   ├── /forceunverify ──── Admin Only
│   ├── /missionchances ─── Show Probabilities
│   │
│   └── MISSION COMMANDS
│       ├── /assault, /skirmish, /coop
│       │   ├── Weighted Selection Algorithm
│       │   ├── Update Selection Buffer
│       │   └── Send Mission + Image
│       │
│       └── /anymission
│           ├── Cross-Category Selection
│           └── Category-Aware Buffer Update
│
└── CLICKS VERIFY BUTTON
    │
    ├── Remove Language -v Roles
    ├── Remove Unverified Role
    ├── Add Verified Role
    ├── Log Action
    └── Delete Modmail Channel
```

## Data Flow Architecture

```
                    CONFIGURATION LAYER
    ┌─────────────────────────────────────────────────────┐
    │  HARDCODED IDS    │  ENVIRONMENT   │  MISSION DATA  │
    │  - Guild IDs      │  - Bot Token   │  - 16 Missions │
    │  - Channel IDs    │  - .env File   │  - Images      │
    │  - Role IDs       │                │  - Categories  │
    └─────┬───────────────────┬───────────────────┬───────┘
          │                   │                   │
          ▼                   ▼                   ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ PERMISSION  │  │ DISCORD API │  │ WEIGHTED    │
    │ VALIDATION  │  │ CONNECTION  │  │ SELECTION   │
    └─────┬───────┘  └─────┬───────┘  └─────┬───────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
                  ┌─────────────┐
                  │ RUNTIME     │
                  │ STATE       │
                  │ MANAGEMENT  │
                  └─────┬───────┘
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
      ▼                 ▼                 ▼
┌───────────┐  ┌─────────────┐  ┌─────────────┐
│ AUTO-     │  │ INVITE      │  │ MISSION     │
│ VERIFY    │  │ CACHE       │  │ BUFFERS     │
│ SETTING   │  │ Map<Guild,  │  │ 4 Arrays    │
│ Boolean   │  │ Map<Code,   │  │ Sliding     │
│           │  │ Uses>>      │  │ Windows     │
└───────────┘  └─────────────┘  └─────────────┘
```

## Role Management Flow

```
ROLE TRANSITION STATES

Standard Roles ←→ Verified (-v) Roles
│
├── Spanish (1242912525243387965) ←→ Spanish-v (1242967391177015428)
├── Italian (1242912483501670400) ←→ Italian-v (1242967518562488392)  
├── English (1242912446738464778) ←→ English-v (1242967468335435777)
├── Japanese (1242912415570595891) ←→ Japanese-v (1242967312349266021)
├── French (1242912381441675294) ←→ French-v (1242967590385614890)
└── German (1242912264244428800) ←→ German-v (1242967426006646856)

VERIFICATION STATUS FLOW

    ┌─────────────┐    User Actions    ┌─────────────┐
    │ UNVERIFIED  ├───────────────────►│  VERIFIED   │
    │ (830119...)  │                   │ (125457...) │
    └─────────────┘◄───────────────────┴─────────────┘
                    Admin Actions

TRIGGERS FOR ROLE CHANGES

├── New Member Join
│   ├── Account Age Check
│   ├── Invite Verification
│   └── Auto-Verify Setting
│
├── Language Role Assignment
│   ├── Member Update Event
│   ├── Unverified Status Check
│   └── Automatic -v Conversion
│
├── Manual Verification
│   ├── Moderator Button Click
│   ├── Role Cleanup Process
│   └── Status Change Logging
│
└── Force Unverify Command
    ├── Administrator Permission
    ├── Role Reversal Process
    └── Language Role Downgrade
```

## Mission Selection Algorithm Flow

```
WEIGHTED RANDOMIZATION PROCESS

Command Input (/assault, /skirmish, /coop, /anymission)
│
├── Get Mission Category
├── Retrieve Category Buffer
├── Calculate Current Statistics
│   ├── Count Occurrences in Buffer
│   ├── Calculate Inverse Pick Rates
│   └── Apply Minimum Weight (0.01)
│
├── Weight Normalization
│   ├── Sum All Weights
│   ├── Divide Each by Sum
│   └── Create Probability Distribution
│
├── Random Selection
│   ├── Generate Random Number [0,1)
│   ├── Walk Through Weighted List
│   └── Select Mission at Threshold
│
├── Buffer Management
│   ├── Add Selection to Buffer
│   ├── Check Buffer Size Limit
│   └── Remove Oldest if Overflow
│
└── Response Generation
    ├── Load Mission Image
    ├── Create Discord Embed
    └── Send to Channel

BUFFER SIZES & MANAGEMENT

Assault Buffer:    [████████████] 12 slots
Skirmish Buffer:   [████████████] 12 slots  
Coop Buffer:       [████████]     8 slots
AnyMission Buffer: [██████████████████] 18 slots

INITIALIZATION STRATEGY
├── Even Distribution: Each mission gets equal slots
├── Random Shuffle: Prevent predictable patterns
├── Sliding Window: FIFO buffer management
└── Real-time Adjustment: Weights update per selection
```

## Permission & Security Model

```
PERMISSION HIERARCHY

Administrator (Level 5)
├── All Commands Available
├── toggleverification
├── forceunverify  
├── Permission Bit: Administrator
└── Can Modify System Settings

     │
     ▼

Moderator (Level 3)
├── Role ID: 207234190805041152
├── View Modmail Channels
├── Access Verify Buttons
├── Log Channel Access
└── Cannot Modify Settings

     │
     ▼

Verified User (Level 2)  
├── Role ID: 1254576308843970593
├── Full Server Access
├── All Mission Commands
├── Language Roles Available
└── Standard Bot Interactions

     │
     ▼

Unverified User (Level 1)
├── Role ID: 830119466967760957
├── Limited Server Access
├── Can Send DMs for Verification
├── Language -v Roles Only
└── Restricted Command Access

SECURITY VALIDATION CHAIN

Input → Permission Check → Role Validation → Action Authorization → Execution
  │           │               │                    │                  │
  ▼           ▼               ▼                    ▼                  ▼
Command    Admin Bit      Guild Member       Feature Access     API Call
Parameter    Check         Lookup             Control           Logging
```

## Channel & Communication Flow

```
CHANNEL ECOSYSTEM

Primary Guild (188322587116306433)
│
├── Modmail Category (1280160927928553534)
│   ├── DM-{username} Channels (Auto-Created)
│   ├── Permission Overwrites
│   │   ├── @everyone: Deny View
│   │   └── Moderators: Allow View/Send
│   └── Lifecycle: Create → Verify → Delete
│
├── Log Channel (1242967139472773271)
│   ├── Verification Actions
│   ├── Administrative Commands
│   ├── Force Unverify Events
│   └── System Notifications
│
├── Image Channels
│   ├── Primary (836618101666611211)
│   └── Secondary (285274392059969546)
│
└── Video Channel (946218801828102184)

COMMUNICATION PATTERNS

User DM → Bot
    ├── Unverified Role Check
    ├── Modmail Channel Creation
    │   ├── Embed Generation
    │   ├── Verify Button Addition
    │   └── Message Relay
    └── Confirmation to User

Moderator → Modmail Channel
    ├── Message Detection
    ├── User ID Extraction
    └── Direct Relay to User

Button Interaction → Verification
    ├── Role Manipulation
    ├── Channel Cleanup
    └── Logging Action
```

## Error Handling & Resilience

```
ERROR HANDLING HIERARCHY

Process Level
├── uncaughtException Handler
├── unhandledRejection Handler  
└── Global Console Logging

Module Level
├── Try-Catch Blocks
├── Promise .catch() Chains
├── Discord API Error Handling
└── Graceful Degradation

Operation Level
├── Role Addition Failures → Continue
├── Channel Creation Failures → Retry
├── Image Loading Failures → Text Fallback
├── Permission Errors → User Notification
└── Rate Limit Handling → Automatic Retry

DATA VALIDATION

Input Validation
├── Discord.js Built-in Validation
├── Permission Bit Verification
├── Guild Member Existence
├── Role Availability Check
└── Channel Access Validation

State Validation  
├── Cache Consistency Checks
├── Buffer Size Management
├── Role Synchronization
└── Invite Cache Updates
```