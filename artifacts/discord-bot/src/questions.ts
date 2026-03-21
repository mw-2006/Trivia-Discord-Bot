export interface TriviaQuestion {
  question: string;
  options: string[];
  answer: string;
  hint?: string;
}

export const triviaQuestions: TriviaQuestion[] = [
  // Easy
  {
    question: "Where does Scott first run into Kip before a game?",
    options: ["Locker Room", "Smoothie shop", "Hotel", "Cottage"],
    answer: "Smoothie shop",
  },
  {
    question: "Where do Scott and Kip share their first night together on screen?",
    options: ["Scott's apartment", "Hotel", "Locker Room", "Charity Event"],
    answer: "Scott's apartment",
  },
  {
    question: "Which championship does Scott win before his big public kiss with Kip?",
    options: ["World Juniors", "Stanley Cup", "Olympics", "All-Star Game"],
    answer: "Stanley Cup",
  },
  {
    question: "Where do Shane and Ilya each open up about their feelings outside the hockey world?",
    options: ["Locker Room", "Cottage", "Hotel Room", "Charity Event"],
    answer: "Cottage",
  },
  {
    question: "Which setting shows Scott struggling with staying closeted before going public?",
    options: ["Locker Room", "Press conference", "Apartment", "Hotel Room"],
    answer: "Press conference",
  },
  {
    question: "Where are Shane and Ilya when they watch Scott's big victory on TV?",
    options: ["Hotel", "Cottage", "Locker Room", "Smoothie shop"],
    answer: "Cottage",
  },

  // Medium
  {
    question: "Which location in the show is tied to a secret early encounter between Ilya and Shane?",
    options: ["Hotel room", "Cottage", "Locker Room", "Arena bench"],
    answer: "Hotel room",
  },
  {
    question: "Where does Ilya first confess love in a way that changes his relationship with Shane?",
    options: ["Hotel Room", "Cottage", "Locker Room", "Arena"],
    answer: "Cottage",
  },
  {
    question: "Where does Scott pull Kip into a public kiss that surprises everyone?",
    options: ["Backyard rink", "Arena ice rink", "Cottage pond", "Practice rink"],
    answer: "Arena ice rink",
  },
  {
    question: "After their first on‑screen training, where does Scott go to celebrate?",
    options: ["Locker Room", "Smoothie shop", "Hotel Room", "Cottage"],
    answer: "Smoothie shop",
  },
  {
    question: "Where does Scott reflect on his performance after watching Kip's celebration on TV?",
    options: ["Apartment", "Locker Room", "Hotel", "Charity event"],
    answer: "Apartment",
  },

  // Hard
  {
    question: "In the books, where do Shane and Ilya first have a long‑term hookup before the cottage scene?",
    options: ["Cottage", "Shane's secret condo", "Hotel", "Locker Room"],
    answer: "Shane's secret condo",
  },
  {
    question: "Where do Shane and Ilya first meet before the main events of *Heated Rivalry*?",
    options: ["World Junior Hockey Championships", "Locker Room", "Cottage", "Hotel"],
    answer: "World Junior Hockey Championships",
  },
  {
    question: "Which location is shown repeatedly when Scott is improving his game after seeing Kip?",
    options: ["Locker room / Reeves arena", "Hotel Room", "Apartment", "Charity Event"],
    answer: "Locker room / Reeves arena",
  },
  {
    question: "Where are Scott and Kip when they finally decide to face the media together?",
    options: ["Press Conference", "Cottage", "Smoothie shop", "Hotel Room"],
    answer: "Press Conference",
  },
  {
    question: "Which location ties into Scott and Kip's first date followed by a deeper conversation?",
    options: ["Charity event followed by apartment visit", "Locker Room", "Cottage", "Hotel Room"],
    answer: "Charity event followed by apartment visit",
  },

  // Extra Hard / Expanded
  {
    question: "Where does Ilya talk about his family issues with Shane in a heartfelt scene?",
    options: ["Hotel Room", "Cottage / heart‑to‑heart scene", "Locker Room", "Arena bench"],
    answer: "Cottage / heart‑to‑heart scene",
  },
  {
    question: "Which location in the books ties to a turning point for Shane's feelings before the cottage scenes?",
    options: ["Hotel after NHL awards", "Locker Room", "Scott's apartment", "Smoothie Shop"],
    answer: "Hotel after NHL awards",
  },
  {
    question: "Which scene shows Scott calling Kip in secret while on the road?",
    options: ["Hotel for away game", "Locker Room", "Cottage", "Apartment"],
    answer: "Hotel for away game",
  },
  {
    question: "Which setting is associated with Scott's pre‑game ritual that he believes improves his performance?",
    options: ["Smoothie shop", "Locker Room", "Hotel", "Cottage"],
    answer: "Smoothie shop",
  },
  {
    question: "Where does Scott first fully come out to the public in the show?",
    options: ["Post‑game interview", "Press Conference", "Cottage", "Hotel Lobby"],
    answer: "Press Conference",
  },

  // Main Character & Scene Mix
  {
    question: "Which setting shows Scott reminiscing about his rivalry turning into friendship with Kip?",
    options: ["Arena ice rink", "Cottage", "Smoothie shop", "Locker Room"],
    answer: "Arena ice rink",
  },
  {
    question: "Where does Kip first confess he didn't want their relationship to be secret?",
    options: ["Locker Room", "Apartment hallway", "Arena bench", "Hotel"],
    answer: "Apartment hallway",
  },
  {
    question: "Which scene shows Shane watching a game that reminds him of Ilya's smile?",
    options: ["Locker Room TV setup", "Cottage porch", "Hotel lobby", "Smoothie shop"],
    answer: "Cottage porch",
  },
  {
    question: "In the show, where does Scott find Kip waiting after a tough practice?",
    options: ["Smoothie shop", "Cottage", "Arena entrance", "Locker Room"],
    answer: "Smoothie shop",
  },
  {
    question: "Which moment happens at the post‑game locker room where Scott and Kip make up after an argument?",
    options: ["Arena ice rink", "Locker Room", "Hotel", "Apartment"],
    answer: "Locker Room",
  },
  {
    question: "Where do Scott and Kip celebrate their first big victory together on screen?",
    options: ["Arena ice rink", "Cottage", "Smoothie shop", "Locker Room"],
    answer: "Arena ice rink",
  },
  {
    question: "Which character confronts Scott in the hotel corridor before he finds Kip?",
    options: ["Ryan Price", "Max Riley", "Fabian Salah", "Ilya Rozanov"],
    answer: "Max Riley",
  },
  {
    question: "At which location does the team gather for a strategy talk before the big game?",
    options: ["Locker Room", "Cottage", "Hotel Lobby", "Smoothie shop"],
    answer: "Locker Room",
  },
  {
    question: "Which setting shows Scott & Kip's first awkward breakfast after a big night?",
    options: ["Cottage kitchen", "Hotel diner", "Smoothie shop", "Locker Room"],
    answer: "Hotel diner",
  },
  {
    question: "Where does Scott find a note from Kip that changes how he views him?",
    options: ["Locker Room bench", "Scott's apartment desk", "Smoothie shop napkin", "Arena locker"],
    answer: "Smoothie shop napkin",
  },

  // OpenAI-generated — scene-accurate expansions
  {
    question: "In Heated Rivalry, where do Shane and Ilya first hook up after meeting at an All-Star event?",
    options: ["A hotel room", "Ilya's apartment", "A team bus", "A locker room"],
    answer: "A hotel room",
  },
  {
    question: "What is Shane Hollander's on-ice position?",
    options: ["Center", "Defenseman", "Goalie", "Left wing"],
    answer: "Center",
  },
  {
    question: "What is Ilya Rozanov's on-ice position?",
    options: ["Right wing", "Defenseman", "Goalie", "Center"],
    answer: "Right wing",
  },
  {
    question: "Which NHL teams are Shane and Ilya primarily associated with in Heated Rivalry?",
    options: ["Montreal Centaurs and Boston Bears", "Toronto Storm and New York Pirates", "Vancouver Orcas and Calgary Flames", "Chicago Hawks and Detroit Wheels"],
    answer: "Montreal Centaurs and Boston Bears",
  },
  {
    question: "What is the nickname often used for the Shane-and-Ilya rivalry by media and fans in-universe?",
    options: ["The Battle of the Beasts", "Heated Rivalry", "The Original Six Feud", "The Hat Trick War"],
    answer: "Heated Rivalry",
  },
  {
    question: "In Heated Rivalry, what kind of event is the recurring backdrop for several Shane/Ilya encounters over the years?",
    options: ["All-Star Weekend", "Training camp", "The NHL draft", "The Winter Classic"],
    answer: "All-Star Weekend",
  },
  {
    question: "In Common Goal, what is Scott Hunter's role on the team?",
    options: ["Team captain", "Rookie call-up", "Assistant coach", "Backup goalie"],
    answer: "Team captain",
  },
  {
    question: "In Common Goal, what is Kip Doyle's profession when the story begins?",
    options: ["Event planner", "Social worker", "Physical therapist", "Sports reporter"],
    answer: "Social worker",
  },
  {
    question: "In Common Goal, what does Kip primarily work with in his social work job?",
    options: ["At-risk youth", "Retired athletes", "Immigrants seeking asylum", "Senior citizens"],
    answer: "At-risk youth",
  },
  {
    question: "In Common Goal, what is one reason Scott is drawn to Kip early on beyond attraction?",
    options: ["Kip challenges him and doesn't care about his fame", "Kip is a lifelong fan of Scott's team", "Kip offers to manage Scott's finances", "Kip is Scott's neighbor"],
    answer: "Kip challenges him and doesn't care about his fame",
  },
  {
    question: "In Heated Rivalry, what personal detail does Shane try hard to keep separate from the media narrative?",
    options: ["His sexuality and private relationships", "His college degree", "His charity work", "His dietary restrictions"],
    answer: "His sexuality and private relationships",
  },
  {
    question: "In Heated Rivalry, what is a notable trait of Ilya's public persona on the ice?",
    options: ["He thrives on provoking opponents and getting under their skin", "He never trash-talks and avoids conflict", "He refuses to do interviews", "He always defers credit to teammates"],
    answer: "He thrives on provoking opponents and getting under their skin",
  },
  {
    question: "In Heated Rivalry, which city is most closely tied to Shane's home team?",
    options: ["Montreal", "Los Angeles", "Dallas", "Columbus"],
    answer: "Montreal",
  },
  {
    question: "In Heated Rivalry, which city is most closely tied to Ilya's home team?",
    options: ["Boston", "San Jose", "Edmonton", "Philadelphia"],
    answer: "Boston",
  },
  {
    question: "In Common Goal, what kind of public-facing activity creates extra pressure for Scott because of his discomfort with vulnerability?",
    options: ["Giving speeches at charity events", "Doing skate sharpening for rookies", "Leading video review sessions", "Negotiating arena contracts"],
    answer: "Giving speeches at charity events",
  },
  {
    question: "In Heated Rivalry, what is the long-term pattern of Shane and Ilya's relationship for much of the book?",
    options: ["Secret hookups that recur over years while they publicly act like enemies", "A public relationship from the beginning", "A brief fling that ends permanently after one night", "An arranged relationship for sponsorships"],
    answer: "Secret hookups that recur over years while they publicly act like enemies",
  },
  {
    question: "In Heated Rivalry, what is a major practical obstacle that keeps Shane and Ilya from being openly together for a long time?",
    options: ["They play for rival teams and fear media fallout", "They live in different countries with visa issues", "One of them is already married", "They are related through a step-parent"],
    answer: "They play for rival teams and fear media fallout",
  },
  {
    question: "In Common Goal, what is one way Kip shows he has boundaries with Scott's celebrity status?",
    options: ["He refuses to be treated like a secret and insists on respect", "He tries to get Scott to sign memorabilia for his friends", "He posts selfies with Scott online immediately", "He asks Scott to pull strings for him at work"],
    answer: "He refuses to be treated like a secret and insists on respect",
  },
  {
    question: "In Heated Rivalry, what is a recurring private dynamic between Shane and Ilya that contrasts their public hostility?",
    options: ["Tenderness and emotional intimacy behind closed doors", "They only ever talk about hockey tactics", "They communicate solely through agents", "They avoid learning anything personal about each other"],
    answer: "Tenderness and emotional intimacy behind closed doors",
  },
  {
    question: "Across the series, which setting is repeatedly used for high-stakes, private conversations after games?",
    options: ["Hotel rooms", "The equipment manager's office", "A hospital waiting room", "A TV studio set"],
    answer: "Hotel rooms",
  },
];

export function pickRandomQuestion(): TriviaQuestion {
  const index = Math.floor(Math.random() * triviaQuestions.length);
  return triviaQuestions[index]!;
}
