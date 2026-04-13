/**
 * Structured interview questions organized by DNA section.
 *
 * This module exports the question banks used by The Coach to conduct
 * Socratic interviews with actors across different psychological and biographical domains.
 *
 * Questions are organized into the following sections:
 * - identity: Self-perception, public vs private self, masks and core identity
 * - family: Family-of-origin dynamics, survival rules, attachment patterns
 * - relationships: Intimacy, trust, loyalty, and relationship patterns
 * - power: Authority, status, rebellion, and approval-seeking behaviors
 * - shame_pride: Secrets, exposure, self-worth, and dignity
 * - loss_and_change: Ruptures, transitions, and turning points
 * - desire_ambition: Wants, hunger, envy, and sacrifice
 * - joy_passion: Flow states, vitality, and core passions
 * - conflict_style: Defense mechanisms, pressure responses, and coping
 * - sensory_anchors: Grounding techniques and sensory-based memory triggers
 * - boundaries_ethics: Limits, ethics, and off-limits topics for acting work
 *
 * @module questions
 */
export const QUESTIONS: Record<string, string[]> = {

  // Identity & Self-Story
  identity: [
    "What do people assume about you that isn’t true?",
    "What part of you do you protect in public?",
    "When you’re at your best, what are you doing?",
    "What’s your default first impression tactic—warmth, competence, humour, mystery, distance?",
    "What do you secretly hope people notice first?",
    "What do you fear they’ll notice first?",
    "What do you never want to be seen as?",
    "What role do you always end up playing in a room?",
    "What’s your 'I’m fine' mask—how does it look on you?",
    "What makes you feel instantly like yourself?",
    "What makes you feel instantly unlike yourself?",
    "If you had a personal motto, what would it be—honest version, not poster version?",
    "What do you need before you can relax?",
    "What do you do when you’re trying to be liked?",
    "What do you do when you’re trying to be respected?",
    "What do you do when you’re trying to be left alone?",
    "What are you willing to fight for, even when it costs you?",
    "What do you most often apologise for?",
    "What do you refuse to apologise for?",
    "What’s the sentence you say that hides what you really mean?",
    "What’s the compliment you struggle to accept?",
    "What’s the criticism that lands too deeply?",
    "When do you feel powerful—specific moment, not concept?",
    "When do you feel small—specific moment, not concept?",
    "What do you do to regain control when you feel small?",
    "What do you do to keep yourself humble when you feel powerful?",
    "What do you want your life to stand for?",
    "What does 'success' look like in your nervous system—how do you behave?",
    "What does 'failure' make you do—what’s your move?",
    "If you were cast wrong, what would the breakdown say about you?"
  ],

  // Belonging & Family Imprint section
  // Ensure the key below matches the exact section ID in your DNA_SECTIONS array
  family: [
    "In your home growing up, what behaviour got rewarded?",
    "In your home growing up, what behaviour got punished?",
    "What did you learn you had to be to be safe?",
    "What did you learn you had to be to be loved?",
    "What emotion was allowed?",
    "What emotion was dangerous?",
    "What was the unspoken rule in the house?",
    "Who had the power—how did they show it?",
    "Who kept the peace—how did they do it?",
    "What did you do when conflict started—hide, fix, perform, fight, freeze?",
    "What did you do to get attention?",
    "What did you do to avoid attention?",
    "Who did you feel responsible for?",
    "Who felt responsible for you?",
    "What was your job in the family system?",
    "What was the family story about money?",
    "What was the family story about love?",
    "What was the family story about ambition?",
    "What was the family story about sex or desire (even indirectly)?",
    "What topic was taboo?",
    "What was never said out loud?",
    "What did you learn about 'being good'?",
    "What did you learn about 'being bad'?",
    "When you broke the rules, what happened?",
    "When you achieved something, what happened?",
    "What did comfort look like in your house?",
    "What did discipline look like in your house?",
    "What did love look like in your house?",
    "What did silence mean in your house?",
    "If your younger self could speak, what would they accuse the adults of?"
  ],

  
  // Relationships & Attachment Patterns section
  // 'relationships' has to match  exact section ID
  relationships: [
    "When you like someone, what do you do to keep them close?",
    "When someone likes you, what do you do that ruins it?",
    "When someone pulls away, what’s your first move?",
    "When you pull away, what are you trying to protect?",
    "What kind of person do you keep choosing?",
    "What kind of person do you keep avoiding?",
    "What do you mistake for love?",
    "What do you mistake for danger?",
    "How do you test people?",
    "How do you punish people without saying you’re punishing them?",
    "What makes you jealous—what’s the threat?",
    "What makes you loyal—what’s the promise?",
    "What makes you leave—what’s the final straw?",
    "What apology actually works on you?",
    "What apology makes you colder?",
    "When someone cries, what do you do?",
    "When you cry, what do you want people to do?",
    "What do you do when you feel unwanted?",
    "What do you do when you feel needed?",
    "What do you do when you feel replaced?",
    "What do you do when you feel adored?",
    "What do you hide from partners/friends even when it would help?",
    "What truth do you want to say but don’t?",
    "What truth do you blurt out and regret?",
    "What behaviour from others makes you shut down?",
    "What behaviour from others makes you soften?",
    "What’s your love tactic—service, humour, intensity, distance, gifts, loyalty?",
    "What’s your conflict tactic—logic, tears, silence, sarcasm, attack, escape?",
    "What do you forgive quickly?",
    "What do you never forget?"
  ],
  
  
  // Power, Authority & Status section
  // 'power' has to be the exact ID registered in DNA_SECTIONS array
  power: [
    "When you enter a room, do you take space or reduce space?",
    "When someone challenges you, what’s your first reflex?",
    "What kind of authority makes you compliant?",
    "What kind of authority makes you rebellious?",
    "What kind of authority makes you charming?",
    "What kind of authority makes you disappear?",
    "When you want power, how do you go after it?",
    "When you have power, what do you do with it?",
    "When you feel powerless, what’s your move?",
    "What do you do to avoid being controlled?",
    "What do you do to control others (even subtly)?",
    "What do you do to regain status after embarrassment?",
    "What’s your relationship to rules—obey, bend, break, rewrite?",
    "What rule do you secretly hate?",
    "What rule do you secretly rely on?",
    "What makes you feel respected?",
    "What makes you feel humiliated?",
    "How do you respond to public criticism?",
    "How do you respond to private criticism?",
    "Who do you become when you’re competing?",
    "Who do you become when you’re losing?",
    "What do you do when you’re underestimated?",
    "What do you do when you’re overestimated?",
    "What’s your status tell—voice, posture, gaze, pace?",
    "What’s your 'don’t mess with me' signal?",
    "What’s your 'please like me' signal?",
    "When you lead, what style—protector, commander, nurturer, entertainer, strategist?",
    "When you follow, what style—loyal, skeptical, passive, helpful, resistant?",
    "What power move do you admire?",
    "What power move disgusts you?"
  ],

  // Shame, Pride & Secrets section
  // Remember to verify if 'shame_pride' matches the exact ID in your DNA_SECTIONS
  shame_pride: [
    "What are you secretly proud of that you never say?",
    "What do you work hard to hide?",
    "What accusation would hurt most to hear?",
    "What compliment would you least believe?",
    "What do you fear people will discover about you?",
    "What do you fear you will discover about you?",
    "What part of you do you judge in others?",
    "What part of you do you excuse in yourself?",
    "What do you do when you feel exposed?",
    "What do you do when you feel admired?",
    "What do you do when you feel guilty?",
    "What do you do when you feel innocent?",
    "What secret would change how people treat you?",
    "What secret do you keep because it protects someone else?",
    "What do you never want to repeat?",
    "What do you keep repeating even when it harms you?",
    "What do you avoid because you might be good at it?",
    "What do you avoid because you might fail publicly?",
    "What do you do when you disappoint someone?",
    "What do you do when someone disappoints you?",
    "What do you do when you disappoint yourself?",
    "What do you do when you’re proud of yourself?",
    "What do you do when you envy someone?",
    "What do you do when you’re ashamed of envy?",
    "What lie do you tell to keep peace?",
    "What truth do you withhold to keep power?",
    "What truth do you withhold to keep love?",
    "What part of you feels 'too much'?",
    "What part of you feels 'not enough'?",
    "What would you do if nobody could judge you?"
  ],

  // Loss, Change & Turning Points section
  // As always, ensure 'loss_and_change' matches the exact ID in your DNA_SECTIONS array
  loss_and_change: [
    "What changed you—made you tougher, sharper, or quieter?",
    "What did you lose that you still measure things against?",
    "What did you survive that you rarely talk about?",
    "What ended before you were ready?",
    "What began before you were ready?",
    "When did you first realise the world wasn’t fair?",
    "When did you first feel truly capable?",
    "What decision are you still paying for?",
    "What decision saved you?",
    "What goodbye still lives in your body as behaviour?",
    "What moment taught you to distrust?",
    "What moment taught you to hope?",
    "Who did you become after that change?",
    "What part of you did you bury to cope?",
    "What part of you did you discover to cope?",
    "What belief died?",
    "What belief was born?",
    "What place do you associate with loss?",
    "What object do you associate with change?",
    "What sound or smell takes you back instantly?",
    "What do you do on anniversaries (even if you don’t notice it’s one)?",
    "What did you learn about endings?",
    "What did you learn about starting again?",
    "What did you learn about asking for help?",
    "What did you learn about refusing help?",
    "What did you learn about forgiveness?",
    "What did you learn about revenge?",
    "What did you learn about patience?",
    "What did you learn about urgency?",
    "What do you do now that your younger self would recognise as growth?"
  ],

  // Desire, Ambition & Hunger section
  // Please verify if 'desire_ambition' is the exact ID registered in your DNA_SECTIONS array
  desire_ambition: [
    "What do you want so badly it scares you?",
    "What do you refuse to settle for?",
    "What do you chase that never satisfies you?",
    "What do you crave when you’re lonely?",
    "What do you crave when you’re successful?",
    "What do you crave when you’re failing?",
    "What do you want people to need you for?",
    "What do you want people to choose you for?",
    "What do you want to prove—and to whom?",
    "What do you want to stop proving?",
    "What’s your fantasy life—one concrete detail?",
    "What’s your nightmare life—one concrete detail?",
    "What do you envy that you pretend you don’t?",
    "What do you desire that you judge?",
    "What do you desire that you protect?",
    "What do you desire that you sabotage?",
    "What do you do when you want something and can’t have it?",
    "What do you do when you want something and you can have it?",
    "What do you do when you’re close to getting what you want?",
    "What do you do when you get what you want?",
    "What do you do when you lose what you want?",
    "What are you willing to sacrifice?",
    "What are you not willing to sacrifice?",
    "What’s the 'price' you secretly expect to pay for success?",
    "What’s the 'price' you refuse to pay for love?",
    "What would you attempt if you couldn’t fail?",
    "What would you attempt if you couldn’t succeed?",
    "Who do you become when desire takes over?",
    "Who do you become when desire disappears?",
    "What desire do you want to honour more honestly?"
  ],

  // Joy, Vitality & Core Passion section
  // Please verify if 'joy_passion' (or whatever you named it) is the exact ID registered in your DNA_SECTIONS array
  joy_passion: [
    "What makes you feel most alive—specific moment?",
    "When do you enter flow without trying?",
    "What do you do that makes time disappear?",
    "What makes you laugh in a way you can’t control?",
    "What makes you cry in a good way?",
    "What are you naturally curious about?",
    "What subject can you talk about for hours?",
    "What do you love that you hide because it feels 'uncool'?",
    "What environment energises you—crowds, silence, nature, city, studio?",
    "What environment drains you fastest?",
    "What kind of people recharge you?",
    "What kind of people exhaust you?",
    "What value feels like joy in action—truth, freedom, loyalty, beauty, justice?",
    "What does play look like for you?",
    "What does rest look like for you?",
    "What do you do when you feel inspired?",
    "What do you do when you feel blocked?",
    "What story type makes you lean forward—revenge, romance, redemption, mystery, survival?",
    "What character energy do you light up in—leader, trickster, protector, rebel, innocent, lover?",
    "What role would you play for free just to live inside it?",
    "What art makes you feel understood?",
    "What art makes you feel braver?",
    "What moment in your life felt like pure expansion?",
    "What moment felt like you were exactly where you belonged?",
    "What do you do when you’re proud—how do you celebrate?",
    "What do you do when you’re content—how do you move?",
    "What do you do when you’re joyful—what’s your tell?",
    "What drains your joy most—comparison, chaos, criticism, boredom, conflict?",
    "What do you need more of to stay vital?",
    "What passion do you want your acting life to honour?"
  ],

  // Conflict Style, Pressure Responses & Coping section
  // Please ensure 'conflict_style' (or whatever you named it) exactly matches the ID in your DNA_SECTIONS array
  conflict_style: [
    "Under pressure, do you speed up or shut down?",
    "When you’re cornered, do you fight, charm, freeze, or disappear?",
    "When you feel judged, what’s your tactic?",
    "When you feel rejected, what do you do first?",
    "When you feel criticised, what do you do first?",
    "When you feel misunderstood, what do you do first?",
    "When you feel trapped, what do you do first?",
    "When you feel bored, what do you do first?",
    "When you feel unsafe, what do you do first?",
    "When you feel overwhelmed, what do you do first?",
    "What’s your default defence—humour, control, intellect, charm, rage, silence?",
    "What’s your default escape—sleep, scrolling, work, sex, food, fantasy?",
    "What makes you snap?",
    "What makes you go cold?",
    "What makes you go quiet?",
    "What makes you go loud?",
    "What makes you go helpful?",
    "What makes you go ruthless?",
    "What do you do after a fight?",
    "What do you do before a fight?",
    "What do you do instead of asking directly?",
    "What do you do instead of saying no?",
    "What do you do when someone says no to you?",
    "What do you do when you have to wait?",
    "What do you do when you can’t fix it?",
    "What do you do when you can fix it?",
    "What do you do when you’re afraid you’ll fail?",
    "What do you do when you’re afraid you’ll succeed?",
    "What do you do when you’re afraid you’ll be seen?",
    "What do you do when you’re afraid you’ll be forgotten?"
  ],

  // Sensory Anchors (safe only) section
  // Please ensure 'sensory_anchors' (or whatever ID you chose) exactly matches the ID in your DNA_SECTIONS array
  sensory_anchors: [
    "Name a place you felt safe. What’s one smell from it?",
    "Name a place you felt safe. What’s one sound from it?",
    "Name a place you felt safe. What’s one texture from it?",
    "What object instantly grounds you?",
    "What colour calms you?",
    "What light calms you—soft, harsh, candle, daylight?",
    "What time of day makes you feel steady?",
    "What weather makes you feel steady?",
    "What scent signals comfort to you?",
    "What sound signals comfort to you?",
    "What song resets you (no need to name it—describe it)?",
    "What silence feels safe to you?",
    "What kind of touch feels safe—if any?",
    "What clothing makes you feel protected?",
    "What food feels like home?",
    "What drink feels like relief?",
    "What routine makes you feel anchored?",
    "What ritual makes you feel brave?",
    "What physical place makes you feel sharp and alert?",
    "What physical place makes you feel soft and open?",
    "What smell makes you feel powerful?",
    "What sound makes you feel powerful?",
    "What smell makes you want to run?",
    "What sound makes you want to run?",
    "What sensory detail signals 'I belong here'?",
    "What sensory detail signals 'I don’t belong here'?",
    "What sensory detail signals 'danger'?",
    "What sensory detail signals 'love'?",
    "What sensory detail signals 'freedom'?",
    "What sensory detail signals 'control'?"
  ],

  // Boundaries, Ethics & Off-Limits section
  // Please verify if 'boundaries_ethics' (or your chosen ID) exactly matches the ID in your DNA_SECTIONS array
  boundaries_ethics: [
    "Are there topics you don’t want the app to use for acting prompts?",
    "What emotional intensity is best for you—light, standard, deep?",
    "What type of question makes you shut down?",
    "What type of question helps you open?",
    "What do you want the coach never to assume about you?",
    "What do you want the coach never to push?",
    "What do you not want to be reminded of in-session?",
    "What do you want the app to treat as 'Private by default'?",
    "What’s a red line for you in acting work?",
    "What’s a red line for you in relationships?",
    "What’s a red line for you in humour?",
    "What’s a red line for you in sexuality?",
    "What’s a red line for you in violence?",
    "What do you never want glamorised?",
    "What do you never want mocked?",
    "What do you never want minimised?",
    "What would you like the coach to do if you get overwhelmed?",
    "What’s the best way to bring you back—pause, lighter question, grounding, end?",
    "What do you want to avoid using as acting fuel?",
    "What are you comfortable using as acting fuel?",
    "What kind of feedback do you want—gentle, direct, ruthless, minimal?",
    "What kind of feedback do you never want?",
    "What should the app do if it detects distress—offer pause, stop, or switch sections?",
    "If shown, do you prefer labels ('Protector') or descriptions ('you protect others by…') ?",
    "What’s the one boundary you want honoured above all else?",
    "What would make you lose trust instantly?",
    "What would make you trust the app more?"
  ]

};