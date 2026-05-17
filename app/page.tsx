"use client";

import { useEffect, useMemo, useState, type PointerEvent, type ChangeEvent } from "react";

import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

type CircleType = "Close Friends" | "Plans" | "Travel" | "Guest Orbit";
type ContactStatus = "Friend" | "Pending" | "Guest" | "Suggested";
type ActiveTab =
  | "home"
  | "circles"
  | "orbit"
  | "loops"
  | "people"
  | "circleDetail";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  avatarUrl?: string;
  status?: string;
};

type Person = {
  id: string;
  name: string;
  initials: string;
  color: string;
  status: ContactStatus;
  email?: string;
  avatarUrl?: string;
};

type FirestorePerson = Person & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

type FriendRequest = {
  id: string;
  fromUserId: string;
  fromName: string;
  fromEmail: string;
  fromPersonId: string;
  toEmail: string;
  toUserId?: string;
  toName?: string;
  status: "pending" | "accepted" | "ignored";
};

type FirestoreCircle = Circle & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

type FirestoreGuestPass = GuestPass & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

type FirestoreFriendRequest = FriendRequest & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

type PostReaction = {
  emoji: string;
  userId: string;
  userName: string;
};

type PostReply = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: string;
  imageUrl?: string;
};

type Post = {
  id: string;
  personId: string;
  personName: string;
  personInitials: string;
  personColor: string;
  personAvatarUrl?: string;
  caption: string;
  time: string;
  mood: string;
  gradient: string;
  prompt: string;
  photoUrl?: string;
  createdAtMs: number;
  expiresAtMs: number;
  reactions?: PostReaction[];
  replies?: PostReply[];
  reportedBy?: string[];
};

type LoopType = "Plan" | "Trip" | "Event" | "Decision" | "Check In";

type LoopStatus =
  | "Idea"
  | "Planning"
  | "Scheduled"
  | "Happening Soon"
  | "Done"
  | "Open"
  | "Voting"
  | "Decided";

type TimingType = "TBD" | "Date + Time" | "All Day" | "Date Range";

type ParticipationStatus = "In" | "Maybe" | "Out";

type LoopTiming = {
  type: TimingType;
  date?: string;
  time?: string;
  endDate?: string;
};

type LoopParticipants = {
  in: string[];
  maybe: string[];
  out: string[];
};

type PollOption = {
  id: string;
  label: string;
  votes: string[];
};

type LoopPoll = {
  question: string;
  options: PollOption[];
};

type LoopTask = {
  id: string;
  title: string;
  owner: string;
  done: boolean;
};

type LoopItem = {
  id: string;
  title: string;
  type: LoopType;
  status: LoopStatus;
  quickNote?: string;
  timing: LoopTiming;
  location?: string;
  people: string[];
  participants: LoopParticipants;
  poll?: LoopPoll;
  tasks: LoopTask[];
  archived?: boolean;
};

type GuestPassDuration = "Tonight" | "24 hours" | "3 days" | "1 week";

type GuestAccess = "Loop only" | "Loop + today’s Orbit" | "Loop + member intros";

type GuestPass = {
  id: string;
  guestName: string;
  circleId: string;
  loopId: string;
  duration: GuestPassDuration;
  access: GuestAccess;
  introPrompt: string;
  note?: string;
  status: "Active" | "Expired";
};

type CircleCoverType = "gradient" | "image";

type Circle = {
  id: string;
  name: string;
  type: CircleType;
  color: string;
  coverType?: CircleCoverType;
  coverImage?: string;
  coverLabel?: string;
  ownerId?: string;
  memberIds?: string[];
  pulse: "Quiet" | "Warming" | "Active" | "Full Pulse";
  dailyPrompt: string;
  members: Person[];
  posts: Post[];
  loop: LoopItem[];
  guest?: boolean;
};

const people: Person[] = [];

const circleColors = [
  "from-cyan-400 to-blue-600",
  "from-fuchsia-400 to-violet-700",
  "from-orange-300 to-rose-600",
  "from-lime-300 to-cyan-500",
  "from-yellow-200 to-orange-500",
  "from-teal-300 to-emerald-700",
];

const circleCoverImages = [
  {
    label: "Dinner",
    url: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Friends",
    url: "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Night Out",
    url: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Beach",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "City",
    url: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Concert",
    url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Cozy",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Nature",
    url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Travel",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80",
  },
  {
    label: "Aurora",
    url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=700&q=80",
  },
];

const avatarColors = [
  "from-cyan-300 to-blue-500",
  "from-lime-300 to-emerald-500",
  "from-fuchsia-300 to-pink-500",
  "from-orange-300 to-red-500",
  "from-violet-300 to-indigo-500",
  "from-rose-200 to-purple-500",
  "from-yellow-200 to-orange-500",
  "from-teal-300 to-cyan-600",
];

const initialCircles: Circle[] = [];

function getInitials(name: string) {
  return name
    .trim()
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getStableColorFromString(value: string) {
  const colorOptions = [
    "from-cyan-300 to-blue-500",
    "from-lime-300 to-emerald-500",
    "from-fuchsia-300 to-pink-500",
    "from-orange-300 to-red-500",
    "from-violet-300 to-indigo-500",
    "from-rose-200 to-purple-500",
    "from-yellow-200 to-orange-500",
    "from-teal-300 to-cyan-600",
  ];

  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }

  return colorOptions[Math.abs(hash) % colorOptions.length];
}

function getPostGradientForUser(userId: string) {
  const gradientOptions = [
    "from-cyan-300 via-blue-500 to-indigo-700",
    "from-fuchsia-300 via-pink-500 to-orange-400",
    "from-lime-300 via-emerald-500 to-teal-700",
    "from-yellow-200 via-orange-400 to-rose-600",
    "from-violet-300 via-purple-500 to-slate-900",
    "from-teal-200 via-cyan-500 to-sky-800",
    "from-rose-200 via-purple-500 to-indigo-800",
    "from-amber-200 via-orange-500 to-red-700",
  ];

  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = userId.charCodeAt(index) + ((hash << 5) - hash);
  }

  return gradientOptions[Math.abs(hash) % gradientOptions.length];
}

const MAX_CIRCLE_NAME_LENGTH = 24;

function getCircleAttentionScore(circle: Circle) {
  const postScore = circle.posts.length;
  const reactionScore = circle.posts.reduce(
    (total, post) => total + (post.reactions?.length || 0),
    0
  );
  const replyScore = circle.posts.reduce(
    (total, post) => total + (post.replies?.length || 0),
    0
  );
  const activeLoopScore = circle.loop.filter((item) => !item.archived).length;

  return postScore + reactionScore + replyScore * 2 + activeLoopScore;
}

function getCircleAttentionLabel(score: number) {
  if (score >= 12) return "High activity";
  if (score >= 6) return "Active";
  if (score >= 2) return "New activity";
  return "";
}

const POST_EXPIRATION_HOURS = 24;
const POST_EXPIRATION_MS = POST_EXPIRATION_HOURS * 60 * 60 * 1000;

function getFirstName(name: string) {
  return name.trim().split(" ")[0] || "there";
}

function getActivePosts(circle: Circle) {
  const now = Date.now();

  return circle.posts.filter((post) => {
    if (!post.expiresAtMs) return true;
    return post.expiresAtMs > now;
  });
}

function getPostExpirationLabel(post: Post) {
  if (!post.expiresAtMs) return "Expires soon";

  const remainingMs = post.expiresAtMs - Date.now();

  if (remainingMs <= 0) return "Expired";

  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

  if (remainingHours <= 1) return "Expires in 1 hour";

  return `Expires in ${remainingHours} hours`;
}

function isLoopComingSoon(loop: LoopItem) {
  if (loop.archived || !loop.timing.date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const loopDate = new Date(`${loop.timing.date}T00:00:00`);

  return loopDate >= today && loopDate <= sevenDaysFromNow;
}

function getComingSoonLoops(circles: Circle[]) {
  return circles
    .flatMap((circle) =>
      circle.loop
        .filter(isLoopComingSoon)
        .filter((loop) => loop.participants.in.length > 0)
        .map((loop) => ({
          ...loop,
          circleName: circle.name,
          circleId: circle.id,
        }))
    )
    .sort((a, b) => {
      const dateA = a.timing.date || "";
      const dateB = b.timing.date || "";
      return dateA.localeCompare(dateB);
    })
    .slice(0, 3);
}

type OrbitNeed = {
  id: string;
  type: "Vote" | "Expiring" | "Plan" | "Invite" | "Catch Up";
  destination: "circle" | "loops" | "people";
  title: string;
  detail: string;
  circleId?: string;
  loopId?: string;
};

type OrbitHotCircle = {
  circle: Circle;
  score: number;
  reason: string;
};

type OrbitMixItem = {
  label: string;
  value: number;
};

type OrbitBrief = {
  modeName: string;
  modeSubtitle: string;
  reason: string;
  nextMoveTitle: string;
  nextMoveDetail: string;
  nextMoveCircleId?: string;
  nextMoveLoopId?: string;
  nextMoveDestination?: "circle" | "loops" | "people";
  stats: string[];
  needs: OrbitNeed[];
  hotCircles: OrbitHotCircle[];
  mix: OrbitMixItem[];
};

function getLoopTimingLabelForOrbit(timing: LoopTiming) {
  if (timing.type === "TBD") return "Timing TBD";

  if (timing.type === "All Day") {
    return timing.date ? `All day · ${timing.date}` : "All day";
  }

  if (timing.type === "Date Range") {
    if (timing.date && timing.endDate) return `${timing.date} to ${timing.endDate}`;
    if (timing.date) return `${timing.date} to TBD`;
    return "Date range TBD";
  }

  if (timing.date && timing.time) return `${timing.date} · ${timing.time}`;
  if (timing.date) return timing.date;

  return "Date and time TBD";
}

function includesAnyKeyword(value: string, keywords: string[]) {
  const normalizedValue = value.toLowerCase();
  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

function getCircleCategory(circle: Circle) {
  const combinedText = `${circle.name} ${circle.type} ${circle.coverLabel || ""} ${circle.loop
    .map((item) => `${item.title} ${item.type}`)
    .join(" ")}`;

  if (
    includesAnyKeyword(combinedText, [
      "trip",
      "travel",
      "bach",
      "bachelorette",
      "bachelor",
      "weekend",
      "vacation",
      "flight",
      "hotel",
      "airbnb",
    ])
  ) {
    return "Trips";
  }

  if (
    includesAnyKeyword(combinedText, [
      "party",
      "birthday",
      "drinks",
      "dinner",
      "brunch",
      "event",
      "wedding",
      "shower",
    ])
  ) {
    return "Events";
  }

  if (
    includesAnyKeyword(combinedText, [
      "book",
      "club",
      "workout",
      "run",
      "gym",
      "class",
      "hobby",
    ])
  ) {
    return "Recurring";
  }

  if (circle.members.length <= 4) {
    return "Close Friends";
  }

  return "Planning";
}

function getOpenPollsForUser(circles: Circle[], currentUser: CurrentUser) {
  return circles.flatMap((circle) =>
    circle.loop
      .filter((loop) => !loop.archived && loop.poll)
      .filter((loop) => {
        const votes = loop.poll?.options.flatMap((option) => option.votes) || [];
        return !votes.includes(currentUser.name);
      })
      .map((loop) => ({
        circle,
        loop,
      }))
  );
}

function getExpiringPosts(circles: Circle[]) {
  const sixHoursFromNow = Date.now() + 6 * 60 * 60 * 1000;

  return circles.flatMap((circle) =>
    getActivePosts(circle)
      .filter((post) => post.expiresAtMs && post.expiresAtMs <= sixHoursFromNow)
      .map((post) => ({
        circle,
        post,
      }))
  );
}

function getUpcomingLoopsForOrbit(circles: Circle[]) {
  return circles.flatMap((circle) =>
    circle.loop
      .filter(isLoopComingSoon)
      .map((loop) => ({
        circle,
        loop,
      }))
  );
}

function getStuckLoops(circles: Circle[]) {
  return circles.flatMap((circle) =>
    circle.loop
      .filter((loop) => !loop.archived)
      .filter((loop) => {
        const hasMaybeResponses = loop.participants.maybe.length >= 2;
        const hasNoDate = !loop.timing.date;
        const hasOpenPoll = Boolean(loop.poll);

        return hasMaybeResponses || hasNoDate || hasOpenPoll;
      })
      .map((loop) => ({
        circle,
        loop,
      }))
  );
}

function getHotCircles(circles: Circle[]): OrbitHotCircle[] {
  return circles
    .map((circle) => {
      const activePosts = getActivePosts(circle);
      const replyCount = activePosts.reduce(
        (total, post) => total + (post.replies?.length || 0),
        0
      );
      const reactionCount = activePosts.reduce(
        (total, post) => total + (post.reactions?.length || 0),
        0
      );
      const activeLoops = circle.loop.filter((loop) => !loop.archived);
      const upcomingLoops = activeLoops.filter(isLoopComingSoon);

      const score =
        activePosts.length * 3 +
        replyCount * 2 +
        reactionCount +
        activeLoops.length * 3 +
        upcomingLoops.length * 4;

      const reasonParts = [];

      if (activePosts.length) {
        reasonParts.push(`${activePosts.length} active ${activePosts.length === 1 ? "post" : "posts"}`);
      }

      if (replyCount) {
        reasonParts.push(`${replyCount} ${replyCount === 1 ? "reply" : "replies"}`);
      }

      if (activeLoops.length) {
        reasonParts.push(`${activeLoops.length} active ${activeLoops.length === 1 ? "Loop" : "Loops"}`);
      }

      if (upcomingLoops.length) {
        reasonParts.push(`${upcomingLoops.length} this week`);
      }

      return {
        circle,
        score,
        reason: reasonParts.length ? reasonParts.join(" · ") : "Quiet right now",
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function getOrbitMix(circles: Circle[]) {
  const totals = new Map<string, number>();

  circles.forEach((circle) => {
    const category = getCircleCategory(circle);
    const activity =
      getActivePosts(circle).length * 2 +
      circle.loop.filter((loop) => !loop.archived).length * 3 +
      1;

    totals.set(category, (totals.get(category) || 0) + activity);
  });

  const totalScore = Array.from(totals.values()).reduce(
    (sum, value) => sum + value,
    0
  );

  if (totalScore === 0) {
    return [{ label: "Quiet", value: 100 }];
  }

  return Array.from(totals.entries())
    .map(([label, score]) => ({
      label,
      value: Math.round((score / totalScore) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}

function calculateOrbitBrief(
  circles: Circle[],
  currentUser: CurrentUser,
  incomingRequests: FriendRequest[]
): OrbitBrief {
  const activePosts = circles.flatMap((circle) => getActivePosts(circle));
  const activeLoops = circles.flatMap((circle) =>
    circle.loop.filter((loop) => !loop.archived)
  );
  const upcomingLoops = getUpcomingLoopsForOrbit(circles);
  const openPolls = getOpenPollsForUser(circles, currentUser);
  const expiringPosts = getExpiringPosts(circles);
  const stuckLoops = getStuckLoops(circles);
  const hotCircles = getHotCircles(circles);
  const mix = getOrbitMix(circles);

  const travelScore = circles.reduce((score, circle) => {
    const category = getCircleCategory(circle);
    const activeScore =
      getActivePosts(circle).length +
      circle.loop.filter((loop) => !loop.archived).length * 2;

    return category === "Trips" ? score + activeScore + 2 : score;
  }, 0);

  const eventScore = circles.reduce((score, circle) => {
    const category = getCircleCategory(circle);
    const activeScore =
      getActivePosts(circle).length +
      circle.loop.filter((loop) => !loop.archived).length * 2;

    return category === "Events" ? score + activeScore + 2 : score;
  }, 0);

  const planningScore = activeLoops.length * 3 + openPolls.length * 4 + stuckLoops.length * 3;
  const catchUpScore = expiringPosts.length * 4 + activePosts.length;
  const socialScore =
    activePosts.length * 2 +
    activePosts.reduce((total, post) => total + (post.replies?.length || 0), 0) * 2 +
    activePosts.reduce((total, post) => total + (post.reactions?.length || 0), 0);

  const topCircle = hotCircles[0];

  let modeName = "Quiet Orbit";
  let modeSubtitle = "You are mostly caught up.";
  let reason = "No major plans, posts, or decisions need attention right now.";

  if (travelScore >= 5 && travelScore >= planningScore && travelScore >= eventScore) {
    modeName = "Travel Bug";
    modeSubtitle = "Your trip Circles are driving the action.";
    reason = "Travel plans, trip Loops, or weekend activity are taking up the most space in your Orbit.";
  } else if (planningScore >= 10) {
    modeName = "The Planner";
    modeSubtitle = "A few Circles need decisions.";
    reason = "You have active Loops, open polls, or plans that still need details.";
  } else if (openPolls.length >= 2 || stuckLoops.length >= 2) {
    modeName = "Decision Point";
    modeSubtitle = "Some plans are waiting on choices.";
    reason = "Polls, Maybe responses, or missing dates are slowing a few Loops down.";
  } else if (eventScore >= 5 || upcomingLoops.length >= 2) {
    modeName = "Booked & Busy";
    modeSubtitle = "Your week has plans coming up.";
    reason = "Upcoming Loops and event activity are giving your Orbit momentum.";
  } else if (socialScore >= 12 && hotCircles.length >= 3) {
    modeName = "Social Butterfly";
    modeSubtitle = "A few Circles are buzzing at once.";
    reason = "Posts, replies, and reactions are spread across multiple Circles.";
  } else if (catchUpScore >= 8) {
    modeName = "Catch Up Crew";
    modeSubtitle = "A few updates are worth checking soon.";
    reason = "Some posts are active or close to expiring.";
  } else if (topCircle && topCircle.score >= 8) {
    modeName = "Inner Circle";
    modeSubtitle = "Most of your energy is in one close space.";
    reason = `${topCircle.circle.name} is carrying most of your Orbit right now.`;
  }

 const needs: OrbitNeed[] = [
  ...openPolls.slice(0, 2).map(({ circle, loop }) => ({
    id: `poll-${circle.id}-${loop.id}`,
    type: "Vote" as const,
    destination: "loops" as const,
    title: "Vote needed",
    detail: `${loop.title} in ${circle.name}`,
    circleId: circle.id,
    loopId: loop.id,
  })),
  ...expiringPosts.slice(0, 2).map(({ circle, post }) => ({
    id: `expiring-${circle.id}-${post.id}`,
    type: "Expiring" as const,
    destination: "circle" as const,
    title: "Post expiring soon",
    detail: `${post.personName}'s post in ${circle.name}`,
    circleId: circle.id,
  })),
  ...stuckLoops.slice(0, 2).map(({ circle, loop }) => ({
    id: `stuck-${circle.id}-${loop.id}`,
    type: "Plan" as const,
    destination: "loops" as const,
    title: "Plan needs shape",
    detail: `${loop.title} in ${circle.name}`,
    circleId: circle.id,
    loopId: loop.id,
  })),
  ...incomingRequests.slice(0, 1).map((request) => ({
    id: `request-${request.id}`,
    type: "Invite" as const,
    destination: "people" as const,
    title: "Friend request",
    detail: `${request.fromName} wants to connect`,
  })),
].slice(0, 5);

  const firstNeed = needs[0];

  const nextMoveTitle =
    firstNeed?.title ||
    (topCircle ? `Check ${topCircle.circle.name}` : "Start a quick post");

  const nextMoveDetail =
    firstNeed?.detail ||
    (topCircle
      ? topCircle.reason
      : "Nothing urgent needs you. Start a post or create a Loop if you want to get people moving.");

  return {
    modeName,
    modeSubtitle,
    reason,
    nextMoveTitle,
    nextMoveDetail,
    nextMoveCircleId: firstNeed?.circleId || topCircle?.circle.id,
    nextMoveLoopId: firstNeed?.loopId,
    nextMoveDestination: firstNeed?.destination || (topCircle ? "circle" : undefined),
    stats: [
      `${activeLoops.length} active ${activeLoops.length === 1 ? "Loop" : "Loops"}`,
      `${openPolls.length} open ${openPolls.length === 1 ? "poll" : "polls"}`,
      `${upcomingLoops.length} this week`,
    ],
    needs,
    hotCircles,
    mix,
  };
}

function Avatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" | "lg" }) {
  const sizeClass =
    size === "sm"
      ? "h-9 w-9 text-xs"
      : size === "lg"
        ? "h-16 w-16 text-lg"
        : "h-11 w-11 text-sm";

  if (person.avatarUrl) {
    return (
      <div
        className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full shadow-lg shadow-black/30 ring-2 ring-white/20`}
      >
        <img
          src={person.avatarUrl}
          alt={person.name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`grid ${sizeClass} shrink-0 place-items-center rounded-full bg-gradient-to-br ${person.color} font-bold text-slate-950 shadow-lg shadow-black/30 ring-2 ring-white/20`}>
      {person.initials}
    </div>
  );
}

function getPerson(circle: Circle, id: string) {
  return circle.members.find((person) => person.id === id) || circle.members[0];
}

function PulseBadge({ pulse }: { pulse: Circle["pulse"] }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80 shadow-inner shadow-white/10">
      {pulse}
    </div>
  );
}

function CircleVisual({
  circle,
  size = "md",
}: {
  circle: Circle;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "h-12 w-12"
      : size === "lg"
        ? "h-28 w-28"
        : "h-16 w-16";

  if (circle.coverType === "image" && circle.coverImage) {
    return (
      <div
        className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full border border-white/20 shadow-lg shadow-black/30`}
      >
        <img
          src={circle.coverImage}
          alt={`${circle.name} cover`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/20" />
      </div>
    );
  }

  return (
    <div
      className={`grid ${sizeClass} shrink-0 place-items-center rounded-full bg-gradient-to-br ${circle.color} shadow-lg shadow-black/30`}
    >
      <div className="h-1/2 w-1/2 rounded-full bg-white/30 blur-sm" />
    </div>
  );
}

export default function Home() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [selectedCircleId, setSelectedCircleId] = useState("");
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const [selectedLoopId, setSelectedLoopId] = useState("");
  const [isCreateCircleOpen, setIsCreateCircleOpen] = useState(false);
  const [isAddUpdateOpen, setIsAddUpdateOpen] = useState(false);
  const [isCreateLoopOpen, setIsCreateLoopOpen] = useState(false);
  const [isCircleSettingsOpen, setIsCircleSettingsOpen] = useState(false);
  const [guestPasses, setGuestPasses] = useState<GuestPass[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
const [isCreateGuestPassOpen, setIsCreateGuestPassOpen] = useState(false);
const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
const [isProfileOpen, setIsProfileOpen] = useState(false);
const [guestPassContext, setGuestPassContext] = useState<{
  circleId: string;
  loopId?: string;
}>({
  circleId: "",
});
const [previewGuestPass, setPreviewGuestPass] = useState<GuestPass | null>(null);

const selectedCircle =
  circles.find((circle) => circle.id === selectedCircleId) || null;


function userToCurrentUser(user: User): CurrentUser {
  const displayName = user.displayName || user.email?.split("@")[0] || "User";

  return {
    id: user.uid,
    name: displayName,
    email: user.email || "",
    initials: getInitials(displayName) || "ME",
    avatarColor: avatarColors[0],
    avatarUrl: "",
    status: "",
  };
}

function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function createUserProfileDoc(user: User, name: string, email: string) {
  const displayName = name.trim() || user.displayName || email.split("@")[0] || "User";

  await setDoc(
    doc(db, "users", user.uid),
    {
      id: user.uid,
      name: displayName,
      email: email.trim(),
      initials: getInitials(displayName) || "ME",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      avatarColor: avatarColors[0],
     avatarUrl: "",
      status: "",
    },
    { merge: true }
  );
}

async function loadCurrentUserProfile(user: User): Promise<CurrentUser> {
  const fallbackUser = userToCurrentUser(user);
  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    return fallbackUser;
  }

  const data = profileSnapshot.data();

  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name
      : fallbackUser.name;

  return {
    ...fallbackUser,
    name,
    email:
      typeof data.email === "string" && data.email.trim()
        ? data.email
        : fallbackUser.email,
    initials:
      typeof data.initials === "string" && data.initials.trim()
        ? data.initials
        : getInitials(name) || "ME",
    avatarColor:
      typeof data.avatarColor === "string" && data.avatarColor.trim()
        ? data.avatarColor
        : avatarColors[0],
    avatarUrl:
      typeof data.avatarUrl === "string"
       ? data.avatarUrl
       : "",
    status:
      typeof data.status === "string"
        ? data.status
        : "",
  };
}

function cleanPersonFromFirestore(data: FirestorePerson): Person {
  return {
    id: data.id,
    name: data.name,
    initials: data.initials,
    color: data.color,
    status: data.status,
    email: data.email,
    avatarUrl: data.avatarUrl,
  };
}

function cleanCircleFromFirestore(data: FirestoreCircle): Circle {
  const members = data.members || [];

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    color: data.color,
    coverType: data.coverType || "gradient",
    coverImage: data.coverImage,
    coverLabel: data.coverLabel,
    ownerId: data.ownerId,
    memberIds: data.memberIds || members.map((member) => member.id),
    pulse: data.pulse,
    dailyPrompt: data.dailyPrompt,
    members,
    posts: data.posts || [],
    loop: data.loop || [],
    guest: data.guest,
  };
}

function cleanGuestPassFromFirestore(data: FirestoreGuestPass): GuestPass {
  return {
    id: data.id,
    guestName: data.guestName,
    circleId: data.circleId,
    loopId: data.loopId,
    duration: data.duration,
    access: data.access,
    introPrompt: data.introPrompt,
    note: data.note,
    status: data.status,
  };
}

function cleanFriendRequestFromFirestore(
  id: string,
  data: FirestoreFriendRequest
): FriendRequest {
  return {
    id,
    fromUserId: data.fromUserId,
    fromName: data.fromName,
    fromEmail: data.fromEmail,
    fromPersonId: data.fromPersonId,
    toEmail: data.toEmail,
    toUserId: data.toUserId,
    toName: data.toName,
    status: data.status,
  };
}

async function createFriendRequestInFirestore(
  request: Omit<FriendRequest, "id">
) {
  const requestRef = await addDoc(collection(db, "friendRequests"), {
    ...request,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(requestRef, {
    id: requestRef.id,
    updatedAt: serverTimestamp(),
  });

  return requestRef.id;
}

async function loadIncomingFriendRequests(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const requestsQuery = query(
    collection(db, "friendRequests"),
    where("toEmail", "==", normalizedEmail),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(requestsQuery);

  return snapshot.docs.map((requestDoc) =>
    cleanFriendRequestFromFirestore(
      requestDoc.id,
      requestDoc.data() as FirestoreFriendRequest
    )
  );
}

async function loadAcceptedOutgoingFriendRequests(userId: string) {
  const requestsQuery = query(
    collection(db, "friendRequests"),
    where("fromUserId", "==", userId),
    where("status", "==", "accepted")
  );

  const snapshot = await getDocs(requestsQuery);

  return snapshot.docs.map((requestDoc) =>
    cleanFriendRequestFromFirestore(
      requestDoc.id,
      requestDoc.data() as FirestoreFriendRequest
    )
  );
}

async function reconcileAcceptedOutgoingRequests(
  userId: string,
  loadedPeople: Person[],
  acceptedRequests: FriendRequest[]
) {
  if (acceptedRequests.length === 0) return loadedPeople;

  let nextPeople = [...loadedPeople];

  for (const request of acceptedRequests) {
    if (!request.toUserId) continue;

    const matchingPerson = nextPeople.find(
      (person) =>
        person.id === request.fromPersonId ||
        person.id === request.toUserId ||
        person.email?.toLowerCase() === request.toEmail.toLowerCase()
    );

    const acceptedPerson: Person = {
      id: request.toUserId,
      name: request.toName || matchingPerson?.name || request.toEmail.split("@")[0],
      email: request.toEmail,
      initials:
        getInitials(request.toName || matchingPerson?.name || request.toEmail.split("@")[0]) ||
        "??",
      color: matchingPerson?.color || "from-cyan-300 to-blue-500",
      status: "Friend",
    };

    nextPeople = [
      acceptedPerson,
      ...nextPeople.filter(
        (person) =>
          person.id !== request.fromPersonId &&
          person.id !== request.toUserId &&
          person.email?.toLowerCase() !== request.toEmail.toLowerCase()
      ),
    ];

    await savePersonToFirestore(userId, acceptedPerson);
  }

  return nextPeople;
}

async function savePersonToFirestore(userId: string, person: Person) {
  await setDoc(
    doc(db, "users", userId, "people", person.id),
    {
      ...sanitizeForFirestore(person),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function loadPeopleFromFirestore(userId: string) {
  const peopleRef = collection(db, "users", userId, "people");
  const snapshot = await getDocs(peopleRef);

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map((personDoc) =>
    cleanPersonFromFirestore(personDoc.data() as FirestorePerson)
  );
}

async function saveCircleToFirestore(userId: string, circle: Circle) {
  const memberIds = Array.from(
    new Set([userId, ...(circle.memberIds || []), ...circle.members.map((member) => member.id)])
  );

  await setDoc(
    doc(db, "circles", circle.id),
    {
      ...sanitizeForFirestore({
        ...circle,
        ownerId: circle.ownerId || userId,
        memberIds,
      }),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function loadCirclesFromFirestore(userId: string) {
  const circlesQuery = query(
    collection(db, "circles"),
    where("memberIds", "array-contains", userId)
  );

  const snapshot = await getDocs(circlesQuery);

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map((circleDoc) =>
    cleanCircleFromFirestore(circleDoc.data() as FirestoreCircle)
  );
}

async function saveGuestPassToFirestore(userId: string, guestPass: GuestPass) {
  await setDoc(
    doc(db, "users", userId, "guestPasses", guestPass.id),
    {
      ...sanitizeForFirestore(guestPass),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function loadGuestPassesFromFirestore(userId: string) {
  const guestPassesRef = collection(db, "users", userId, "guestPasses");
  const snapshot = await getDocs(guestPassesRef);

  if (snapshot.empty) return [];

  return snapshot.docs.map((guestPassDoc) =>
    cleanGuestPassFromFirestore(guestPassDoc.data() as FirestoreGuestPass)
  );
}

async function loadAppDataFromFirestore(userId: string, email: string) {
  const [
    loadedPeople,
    loadedCircles,
    loadedGuestPasses,
    loadedIncomingRequests,
    loadedAcceptedOutgoingRequests,
  ] = await Promise.all([
    loadPeopleFromFirestore(userId),
    loadCirclesFromFirestore(userId),
    loadGuestPassesFromFirestore(userId),
    loadIncomingFriendRequests(email),
    loadAcceptedOutgoingFriendRequests(userId),
  ]);

  const reconciledPeople = await reconcileAcceptedOutgoingRequests(
    userId,
    loadedPeople,
    loadedAcceptedOutgoingRequests
  );

  setContacts(reconciledPeople);
  setCircles(loadedCircles);
  setGuestPasses(loadedGuestPasses);
  setIncomingRequests(loadedIncomingRequests);

  if (loadedCircles.length > 0) {
    setSelectedCircleId(loadedCircles[0].id);
    setSelectedPostIndex(0);
  } else {
    setSelectedCircleId("");
    setSelectedPostIndex(0);
  }
}

function updateCircleLocallyAndInFirestore(
  circleId: string,
  updater: (circle: Circle) => Circle
) {
  const existingCircle = circles.find((circle) => circle.id === circleId);
  if (!existingCircle) return;

  const updatedCircle = updater(existingCircle);

  setCircles((currentCircles) =>
    currentCircles.map((circle) =>
      circle.id === circleId ? updatedCircle : circle
    )
  );

  if (currentUser) {
    saveCircleToFirestore(currentUser.id, updatedCircle).catch((error) => {
      console.error("Error saving Circle to Firestore:", error);
    });
  }
}

useEffect(() => {
  const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      const profile = await loadCurrentUserProfile(user);
      setCurrentUser(profile);
    } else {
      setCurrentUser(null);
    }

    setAuthLoading(false);
  });

  return () => unsubscribe();
}, []);

useEffect(() => {
  if (!currentUser) return;

  loadAppDataFromFirestore(currentUser.id, currentUser.email).catch((error) => {
    console.error("Error loading app data from Firestore:", error);
  });
}, [currentUser?.id]);

  function openCircle(circleId: string) {
  setSelectedCircleId(circleId);
  setSelectedPostIndex(0);
  setSelectedLoopId("");
  setActiveTab("circleDetail");
}

function openLoop(circleId: string, loopId: string) {
  setSelectedCircleId(circleId);
  setSelectedLoopId(loopId);
  setActiveTab("loops");
}

async function createCircle(newCircle: Circle) {
  if (!currentUser) return;

  const currentUserAsPerson: Person = {
  id: currentUser.id,
  name: currentUser.name,
  initials: currentUser.initials,
  color: currentUser.avatarColor || "from-white to-slate-300",
  status: "Friend",
  email: currentUser.email,
  avatarUrl: currentUser.avatarUrl,
};

  const uniqueMembers = [
    currentUserAsPerson,
    ...newCircle.members.filter((member) => member.id !== currentUser.id),
  ];

  const sharedCircle: Circle = {
    ...newCircle,
    ownerId: currentUser.id,
    members: uniqueMembers,
    memberIds: Array.from(new Set(uniqueMembers.map((member) => member.id))),
  };

  setCircles((currentCircles) => [sharedCircle, ...currentCircles]);
  setSelectedCircleId(sharedCircle.id);
  setSelectedPostIndex(0);
  setIsCreateCircleOpen(false);
  setActiveTab("circleDetail");

  await saveCircleToFirestore(currentUser.id, sharedCircle);
}

async function updateCircleSettings(updatedCircle: Circle) {
  if (!currentUser) return;

  setCircles((currentCircles) =>
    currentCircles.map((circle) =>
      circle.id === updatedCircle.id ? updatedCircle : circle
    )
  );

  setSelectedCircleId(updatedCircle.id);
  setIsCircleSettingsOpen(false);

  await saveCircleToFirestore(currentUser.id, updatedCircle);
}

async function leaveCircle(circleId: string) {
  if (!currentUser) return;

  const circleToLeave = circles.find((circle) => circle.id === circleId);
  if (!circleToLeave) return;

  const updatedCircle: Circle = {
    ...circleToLeave,
    members: circleToLeave.members.filter(
      (member) => member.id !== currentUser.id
    ),
    memberIds: (circleToLeave.memberIds || []).filter(
      (memberId) => memberId !== currentUser.id
    ),
  };

  await updateDoc(doc(db, "circles", circleId), {
    ...sanitizeForFirestore(updatedCircle),
    updatedAt: serverTimestamp(),
  });

  const remainingCircles = circles.filter((circle) => circle.id !== circleId);
  setCircles(remainingCircles);
  setIsCircleSettingsOpen(false);
  setActiveTab("home");

  if (remainingCircles.length > 0) {
    setSelectedCircleId(remainingCircles[0].id);
  } else {
    setSelectedCircleId("");
  }
}

async function uploadAvatarPhoto(file: File) {
  if (!currentUser) {
    throw new Error("You need to be signed in to upload an avatar.");
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `users/${currentUser.id}/profile/${Date.now()}-${safeFileName}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file);

  return getDownloadURL(storageRef);
}

async function uploadPostPhoto(circleId: string, file: File) {
  if (!currentUser) {
    throw new Error("You need to be signed in to upload a photo.");
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `circles/${circleId}/posts/${currentUser.id}/${Date.now()}-${safeFileName}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file);

  return getDownloadURL(storageRef);
}

async function uploadReplyPhoto(circleId: string, postId: string, file: File) {
  if (!currentUser) {
    throw new Error("You need to be signed in to upload a reply image.");
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `circles/${circleId}/posts/${postId}/replies/${currentUser.id}/${Date.now()}-${safeFileName}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file);

  return getDownloadURL(storageRef);
}

async function addPostToCircle(caption: string, mood: string, photoFile?: File) {
  if (!currentUser) return;

  let uploadedPhotoUrl: string | undefined;

  if (photoFile) {
    uploadedPhotoUrl = await uploadPostPhoto(selectedCircleId, photoFile);
  }

const createdAtMs = Date.now();
const expiresAtMs = createdAtMs + POST_EXPIRATION_MS;

  const newPost: Post = {
    id: `post-${Date.now()}`,
    personId: currentUser.id,
    personName: currentUser.name,
    personInitials: currentUser.initials,
    personColor: currentUser.avatarColor || getStableColorFromString(currentUser.id),
    personAvatarUrl: currentUser.avatarUrl,
    caption,
    time: "Just now",
    mood,
    prompt: selectedCircle?.dailyPrompt || "What is your energy today?",
    photoUrl: uploadedPhotoUrl,
    createdAtMs,
    expiresAtMs,
    gradient: getPostGradientForUser(currentUser.id),
    reactions: [],
    replies: [],
  };

  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    posts: [newPost, ...circle.posts],
    pulse: circle.pulse === "Quiet" ? "Warming" : circle.pulse,
  }));

  setSelectedPostIndex(0);
  setIsAddUpdateOpen(false);
  setActiveTab("circleDetail");
}

function reactToPost(postId: string, emoji: string) {
  if (!currentUser || !emoji.trim()) return;

  const cleanedEmoji = emoji.trim();
  const maxReactionsPerPerson = 3;

  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    posts: circle.posts.map((post) => {
      if (post.id !== postId) return post;

      const existingReactions = post.reactions || [];

      const alreadyReactedWithEmoji = existingReactions.some(
        (reaction) =>
          reaction.userId === currentUser.id &&
          reaction.emoji === cleanedEmoji
      );

      if (alreadyReactedWithEmoji) {
        return {
          ...post,
          reactions: existingReactions.filter(
            (reaction) =>
              !(
                reaction.userId === currentUser.id &&
                reaction.emoji === cleanedEmoji
              )
          ),
        };
      }

      const userReactionCount = existingReactions.filter(
        (reaction) => reaction.userId === currentUser.id
      ).length;

      if (userReactionCount >= maxReactionsPerPerson) {
        return post;
      }

      return {
        ...post,
        reactions: [
          ...existingReactions,
          {
            emoji: cleanedEmoji,
            userId: currentUser.id,
            userName: currentUser.name,
          },
        ],
      };
    }),
  }));
}

async function replyToPost(postId: string, text: string, imageFile?: File) {
  if (!currentUser || (!text.trim() && !imageFile)) return;

  let uploadedImageUrl: string | undefined;

  if (imageFile) {
    uploadedImageUrl = await uploadReplyPhoto(selectedCircleId, postId, imageFile);
  }

  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    posts: circle.posts.map((post) => {
      if (post.id !== postId) return post;

      const existingReplies = post.replies || [];

      return {
        ...post,
        replies: [
          ...existingReplies,
          {
            id: `reply-${Date.now()}`,
            text: text.trim(),
            userId: currentUser.id,
            userName: currentUser.name,
            createdAt: "Just now",
            imageUrl: uploadedImageUrl,
          },
        ],
      };
    }),
  }));
}

function addLoopToCircle(loopItem: LoopItem) {
  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    loop: [loopItem, ...circle.loop],
  }));

  setSelectedLoopId(loopItem.id);
  setIsCreateLoopOpen(false);
  setActiveTab("loops");
}

function archiveLoop(loopId: string) {
  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    loop: circle.loop.map((item) =>
      item.id === loopId ? { ...item, archived: true } : item
    ),
  }));
}

function setLoopParticipation(
  loopId: string,
  personName: string,
  status: ParticipationStatus
) {
  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    loop: circle.loop.map((item) => {
      if (item.id !== loopId) return item;

      const withoutPerson: LoopParticipants = {
        in: item.participants.in.filter((name) => name !== personName),
        maybe: item.participants.maybe.filter((name) => name !== personName),
        out: item.participants.out.filter((name) => name !== personName),
      };

      const nextKey = status.toLowerCase() as keyof LoopParticipants;

      const nextParticipants: LoopParticipants = {
        ...withoutPerson,
        [nextKey]: [...withoutPerson[nextKey], personName],
      };

      return {
        ...item,
        participants: nextParticipants,
      };
    }),
  }));
}

function voteOnLoopPollInCircle(
  circleId: string,
  loopId: string,
  optionId: string,
  personName: string
) {
  updateCircleLocallyAndInFirestore(circleId, (circle) => ({
    ...circle,
    loop: circle.loop.map((item) => {
      if (item.id !== loopId || !item.poll) return item;

      return {
        ...item,
        poll: {
          ...item.poll,
          options: item.poll.options.map((option) => {
            const votesWithoutPerson = option.votes.filter(
              (name) => name !== personName
            );

            if (option.id !== optionId) {
              return {
                ...option,
                votes: votesWithoutPerson,
              };
            }

            return {
              ...option,
              votes: [...votesWithoutPerson, personName],
            };
          }),
        },
      };
    }),
  }));
}

function toggleLoopTaskInCircle(circleId: string, loopId: string, taskId: string) {
  updateCircleLocallyAndInFirestore(circleId, (circle) => ({
    ...circle,
    loop: circle.loop.map((item) => {
      if (item.id !== loopId) return item;

      return {
        ...item,
        tasks: item.tasks.map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task
        ),
      };
    }),
  }));
}

function voteOnLoopPoll(loopId: string, optionId: string, personName: string) {
  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    loop: circle.loop.map((item) => {
      if (item.id !== loopId || !item.poll) return item;

      return {
        ...item,
        poll: {
          ...item.poll,
          options: item.poll.options.map((option) => {
            const votesWithoutPerson = option.votes.filter(
              (name) => name !== personName
            );

            if (option.id !== optionId) {
              return {
                ...option,
                votes: votesWithoutPerson,
              };
            }

            return {
              ...option,
              votes: [...votesWithoutPerson, personName],
            };
          }),
        },
      };
    }),
  }));
}

function toggleLoopTask(loopId: string, taskId: string) {
  updateCircleLocallyAndInFirestore(selectedCircleId, (circle) => ({
    ...circle,
    loop: circle.loop.map((item) => {
      if (item.id !== loopId) return item;

      return {
        ...item,
        tasks: item.tasks.map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task
        ),
      };
    }),
  }));
}

function openGuestPass(circleId: string, loopId?: string) {
  setGuestPassContext({ circleId, loopId });
  setIsCreateGuestPassOpen(true);
}

async function createGuestPass(passDetails: Omit<GuestPass, "id" | "status">) {
  const newGuestPass: GuestPass = {
    ...passDetails,
    id: `guest-pass-${Date.now()}`,
    status: "Active",
  };

  setGuestPasses((currentPasses) => [newGuestPass, ...currentPasses]);
  setIsCreateGuestPassOpen(false);
  setPreviewGuestPass(newGuestPass);

  if (currentUser) {
    await saveGuestPassToFirestore(currentUser.id, newGuestPass);
  }
}

async function addPersonToPeople(
  name: string,
  email: string,
  _status: ContactStatus
) {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  if (!trimmedEmail) return;

  const displayName =
    trimmedName ||
    trimmedEmail
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colorOptions = [
    "from-cyan-300 to-blue-500",
    "from-lime-300 to-emerald-500",
    "from-fuchsia-300 to-pink-500",
    "from-orange-300 to-red-500",
    "from-violet-300 to-indigo-500",
    "from-rose-200 to-purple-500",
  ];

  const newPerson: Person = {
    id: `person-${Date.now()}`,
    name: displayName,
    email: trimmedEmail,
    initials: initials || "??",
    color: colorOptions[Math.floor(Math.random() * colorOptions.length)],
    status: "Pending",
  };

  setContacts((currentContacts) => [newPerson, ...currentContacts]);
  setIsAddPersonOpen(false);

  if (!currentUser) return;

  await savePersonToFirestore(currentUser.id, newPerson);

  await createFriendRequestInFirestore({
    fromUserId: currentUser.id,
    fromName: currentUser.name,
    fromEmail: currentUser.email.trim().toLowerCase(),
    fromPersonId: newPerson.id,
    toEmail: trimmedEmail,
    status: "pending",
  });
}

async function removeFriend(personId: string) {
  if (!currentUser) return;

  setContacts((currentContacts) =>
    currentContacts.filter((person) => person.id !== personId)
  );

  await updateDoc(doc(db, "users", currentUser.id, "people", personId), {
    status: "Suggested",
    updatedAt: serverTimestamp(),
  });
}

async function updatePersonStatus(personId: string, status: ContactStatus) {
  setContacts((currentContacts) =>
    currentContacts.map((person) =>
      person.id === personId ? { ...person, status } : person
    )
  );

  if (!currentUser) return;

  await updateDoc(doc(db, "users", currentUser.id, "people", personId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

async function acceptFriendRequest(request: FriendRequest) {
  if (!currentUser) return;

  const requesterAsPerson: Person = {
    id: request.fromUserId,
    name: request.fromName,
    email: request.fromEmail,
    initials: getInitials(request.fromName) || "??",
    color: "from-cyan-300 to-blue-500",
    status: "Friend",
    avatarUrl: currentUser.avatarUrl,
  };

  await savePersonToFirestore(currentUser.id, requesterAsPerson);

  await updateDoc(doc(db, "friendRequests", request.id), {
  status: "accepted",
  toUserId: currentUser.id,
  toName: currentUser.name,
  updatedAt: serverTimestamp(),
});


  setContacts((currentContacts) => {
    const alreadyExists = currentContacts.some(
      (person) => person.id === requesterAsPerson.id
    );

    if (alreadyExists) {
      return currentContacts.map((person) =>
        person.id === requesterAsPerson.id ? requesterAsPerson : person
      );
    }

    return [requesterAsPerson, ...currentContacts];
  });

  setIncomingRequests((currentRequests) =>
    currentRequests.filter((item) => item.id !== request.id)
  );
}

async function ignoreFriendRequest(request: FriendRequest) {
  await updateDoc(doc(db, "friendRequests", request.id), {
    status: "ignored",
    updatedAt: serverTimestamp(),
  });

  setIncomingRequests((currentRequests) =>
    currentRequests.filter((item) => item.id !== request.id)
  );
}


async function handleAuthSubmit(
  mode: "sign-in" | "sign-up",
  name: string,
  email: string,
  password: string
) {
  setAuthError("");

  try {
    if (mode === "sign-up") {
      const credential = await createUserWithEmailAndPassword(
  firebaseAuth,
  email.trim(),
  password
);

await updateProfile(credential.user, {
  displayName: name.trim(),
});

await createUserProfileDoc(
  credential.user,
  name.trim(),
  credential.user.email || email.trim()
);

setCurrentUser({
  id: credential.user.uid,
  name: name.trim(),
  email: credential.user.email || email.trim(),
  initials: getInitials(name.trim()) || "ME",
  avatarColor: avatarColors[0],
  avatarUrl: "",
  status: "",
});

return;
    }

    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong signing in.";

    setAuthError(message);
  }
}

async function handleSignOut() {
  await signOut(firebaseAuth);
  setCurrentUser(null);
  setActiveTab("home");
}

async function handleUpdateProfile(profile: {
  name: string;
  avatarColor: string;
  status: string;
  avatarFile?: File;
}) {
  if (!currentUser || !firebaseAuth.currentUser) return;

  const nextName = profile.name.trim() || currentUser.name;
  const nextInitials = getInitials(nextName) || currentUser.initials;
  let nextAvatarUrl = currentUser.avatarUrl || "";

if (profile.avatarFile) {
  nextAvatarUrl = await uploadAvatarPhoto(profile.avatarFile);
}

  await updateProfile(firebaseAuth.currentUser, {
    displayName: nextName,
  });

  await setDoc(
    doc(db, "users", currentUser.id),
    {
      name: nextName,
      initials: nextInitials,
      avatarColor: profile.avatarColor,
      avatarUrl: nextAvatarUrl,
      status: profile.status.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  setCurrentUser({
    ...currentUser,
    name: nextName,
    initials: nextInitials,
    avatarColor: profile.avatarColor,
    avatarUrl: nextAvatarUrl,
    status: profile.status.trim(),
  });
}

async function handleChangePassword(newPassword: string) {
  if (!firebaseAuth.currentUser) {
    throw new Error("You need to be signed in to change your password.");
  }

  await updatePassword(firebaseAuth.currentUser, newPassword);
}

if (authLoading) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 text-white">
      <div className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm text-white/70">
        Loading Circles...
      </div>
    </main>
  );
}

if (!currentUser) {
  return <AuthScreen onAuthSubmit={handleAuthSubmit} authError={authError} />;
}

  return (
    <main className="min-h-dvh overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.26),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(217,70,239,0.23),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(132,204,22,0.16),transparent_32%)]" />
<div className="pointer-events-none fixed inset-0 backdrop-blur-3xl" />

      <section className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden border-x border-white/10 bg-slate-950/55 shadow-2xl shadow-black">
        {activeTab !== "people" && (
  <Header
    circle={selectedCircle}
    activeTab={activeTab}
    currentUser={currentUser}
    onOpenProfile={() => setIsProfileOpen(true)}
    onOpenCircleSettings={() => setIsCircleSettingsOpen(true)}
  />
)}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(18rem+env(safe-area-inset-bottom))] pt-3 [-webkit-overflow-scrolling:touch]">
          {activeTab === "home" && (
  <HomeView
    circles={circles}
    guestPassCount={guestPasses.length}
    currentUser={currentUser}
    onOpenCircle={openCircle}
    selectedCircleId={selectedCircleId}
    setSelectedCircleId={setSelectedCircleId}
    onCreateCircle={() => setIsCreateCircleOpen(true)}
    onOpenProfile={() => setIsProfileOpen(true)}
    onViewAllCircles={() => setActiveTab("circles")}
  />
)}

{activeTab === "circles" && (
  <CirclesView
    circles={circles}
    selectedCircleId={selectedCircleId}
    onOpenCircle={openCircle}
    onCreateCircle={() => setIsCreateCircleOpen(true)}
  />
)}

{activeTab === "orbit" && (
  <OrbitBriefView
    circles={circles}
    currentUser={currentUser}
    incomingRequests={incomingRequests}
    onOpenCircle={openCircle}
    onOpenLoop={openLoop}
    onOpenPeople={() => setActiveTab("people")}
  />
)}

{activeTab === "loops" && (
  <LoopsDashboardView
    circles={circles}
    currentUser={currentUser}
    selectedLoopId={selectedLoopId}
    onOpenCircle={openCircle}
    onOpenLoop={openLoop}
    onVotePoll={voteOnLoopPollInCircle}
    onToggleTask={toggleLoopTaskInCircle}
  />
)}

{activeTab === "circleDetail" && selectedCircle && (
  <OrbitView
    circle={selectedCircle}
    currentUserId={currentUser.id}
    selectedPostIndex={selectedPostIndex}
    setSelectedPostIndex={setSelectedPostIndex}
    onOpenAddUpdate={() => setIsAddUpdateOpen(true)}
    onOpenCreateLoop={() => setIsCreateLoopOpen(true)}
    onOpenCircleSettings={() => setIsCircleSettingsOpen(true)}
    onArchiveLoop={archiveLoop}
    onSetParticipation={setLoopParticipation}
    onVotePoll={voteOnLoopPoll}
    onToggleTask={toggleLoopTask}
    onOpenGuestPass={openGuestPass}
    onReactToPost={reactToPost}
    onReplyToPost={replyToPost}
  />
)}

{activeTab === "circleDetail" && !selectedCircle && (
  <div className="rounded-[2.5rem] border border-white/10 bg-white/8 p-6 text-center shadow-xl shadow-black/20 backdrop-blur-2xl">
    <h2 className="text-2xl font-semibold">No Circle yet.</h2>
    <p className="mt-3 text-sm leading-6 text-white/55">
      Create your first Circle to start an Orbit.
    </p>
    <button
      onClick={() => setIsCreateCircleOpen(true)}
      className="mt-5 w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 active:scale-[0.98]"
    >
      Create a Circle
    </button>
  </div>
)}

          {activeTab === "people" && (
<PeopleView
  contacts={contacts}
  incomingRequests={incomingRequests}
  onOpenAddPerson={() => setIsAddPersonOpen(true)}
  onUpdatePersonStatus={updatePersonStatus}
  onRemoveFriend={removeFriend}
  onAcceptFriendRequest={acceptFriendRequest}
  onIgnoreFriendRequest={ignoreFriendRequest}
/>
)}
        </div>

        <BottomNav
  activeTab={activeTab}
  setActiveTab={setActiveTab}
  requestCount={incomingRequests.length}
/>

{isProfileOpen && (
  <ProfileModal
    currentUser={currentUser}
    onClose={() => setIsProfileOpen(false)}
    onUpdateProfile={handleUpdateProfile}
    onChangePassword={handleChangePassword}
    onSignOut={handleSignOut}
  />
)}

{isCircleSettingsOpen && selectedCircle && currentUser && (
  <CircleSettingsModal
    circle={selectedCircle}
    contacts={contacts.filter((person) => person.status === "Friend")}
    currentUser={currentUser}
    onClose={() => setIsCircleSettingsOpen(false)}
    onSave={updateCircleSettings}
    onLeave={leaveCircle}
  />
)}

        {isCreateCircleOpen && (
         <CreateCircleModal
  contacts={contacts.filter((person) => person.status === "Friend")}
  onClose={() => setIsCreateCircleOpen(false)}
  onCreateCircle={createCircle}
/>
        )}
        {isAddUpdateOpen && selectedCircle && (
  <AddUpdateModal
    circle={selectedCircle}
    onClose={() => setIsAddUpdateOpen(false)}
    onAddPost={addPostToCircle}
  />
)}
{isCreateLoopOpen && selectedCircle && (
  <CreateLoopModal
    circle={selectedCircle}
    onClose={() => setIsCreateLoopOpen(false)}
    onCreateLoop={addLoopToCircle}
  />
)}

{isCreateGuestPassOpen && (
  <CreateGuestPassModal
  circles={circles}
  contacts={contacts.filter((person) => person.status === "Friend")}
  initialCircleId={guestPassContext.circleId}
  initialLoopId={guestPassContext.loopId}
  onClose={() => setIsCreateGuestPassOpen(false)}
  onCreateGuestPass={createGuestPass}
/>
)}

{previewGuestPass && (
  <GuestPassPreviewModal
    guestPass={previewGuestPass}
    circles={circles}
    onClose={() => setPreviewGuestPass(null)}
  />
)}

{isAddPersonOpen && (
  <AddPersonModal
    onClose={() => setIsAddPersonOpen(false)}
    onAddPerson={addPersonToPeople}
  />
)}

      </section>
    </main>
  );
}

function CircleSettingsModal({
  circle,
  contacts,
  currentUser,
  onClose,
  onSave,
  onLeave,
}: {
  circle: Circle;
  contacts: Person[];
  currentUser: CurrentUser;
  onClose: () => void;
  onSave: (circle: Circle) => void;
  onLeave: (circleId: string) => void;
}) {
  const [circleName, setCircleName] = useState(circle.name);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>(
    circle.members.map((member) => member.id)
  );
  const [peopleSearch, setPeopleSearch] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const availablePeople = contacts.filter(
    (person) =>
      person.id !== currentUser.id &&
      !circle.members.some((member) => member.id === person.id) &&
      (person.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
        person.email?.toLowerCase().includes(peopleSearch.toLowerCase()))
  );

  const selectedPeople = selectedPeopleIds
    .map(
      (personId) =>
        circle.members.find((member) => member.id === personId) ||
        contacts.find((person) => person.id === personId)
    )
    .filter(Boolean) as Person[];

  const canSave =
    circleName.trim().length > 1 &&
    circleName.trim().length <= MAX_CIRCLE_NAME_LENGTH &&
    selectedPeople.length >= 1 &&
    selectedPeople.length <= 8;

  function togglePerson(personId: string) {
    if (personId === currentUser.id) return;

    setSelectedPeopleIds((currentIds) => {
      if (currentIds.includes(personId)) {
        return currentIds.filter((id) => id !== personId);
      }

      if (currentIds.length >= 8) return currentIds;

      return [...currentIds, personId];
    });
  }

  function handleSave() {
    if (!canSave) return;

    const currentUserAsPerson: Person = {
  id: currentUser.id,
  name: currentUser.name,
  initials: currentUser.initials,
  color: currentUser.avatarColor,
  status: "Friend",
  email: currentUser.email,
  avatarUrl: currentUser.avatarUrl,
};

    const nextMembers = [
      currentUserAsPerson,
      ...selectedPeople.filter((person) => person.id !== currentUser.id),
    ];

    const updatedCircle: Circle = {
      ...circle,
      name: circleName.trim(),
      members: nextMembers,
      memberIds: Array.from(new Set(nextMembers.map((member) => member.id))),
    };

    onSave(updatedCircle);
  }

  return (
    <div className="fixed inset-0 z-[260] overflow-hidden bg-slate-950/80 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-h-full w-full max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black">
        <div className="shrink-0 border-b border-white/10 bg-slate-950/80 p-4 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">Circle Settings</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Manage Circle.
              </h2>
            </div>

            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <label className="text-sm text-white/60">Circle name</label>
            <input
              value={circleName}
              maxLength={MAX_CIRCLE_NAME_LENGTH}
              onChange={(event) => setCircleName(event.target.value)}
              className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />

            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-white/35">
                Keep it short so it looks clean on mobile.
              </span>
              <span
                className={
                  circleName.length >= MAX_CIRCLE_NAME_LENGTH
                    ? "text-orange-200"
                    : "text-white/35"
                }
              >
                {circleName.length}/{MAX_CIRCLE_NAME_LENGTH}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white/75">
                  Members
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {selectedPeople.length}/8 people
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPeople.map((person) => {
                const isCurrentUser = person.id === currentUser.id;

                return (
                  <button
                    key={person.id}
                    onClick={() => togglePerson(person.id)}
                    disabled={isCurrentUser}
                    className={`rounded-full px-3 py-2 text-xs font-semibold active:scale-95 ${
                      isCurrentUser
                        ? "bg-white text-slate-950"
                        : "bg-white/10 text-white/65"
                    }`}
                  >
                    {person.name}
                    {!isCurrentUser && " ×"}
                  </button>
                );
              })}
            </div>

            {selectedPeople.length < 8 && (
              <>
                <div className="mt-5">
                  <label className="text-sm text-white/60">
                    Add more People
                  </label>
                  <input
                    value={peopleSearch}
                    onChange={(event) => setPeopleSearch(event.target.value)}
                    placeholder="Search your People"
                    className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
                  />
                </div>

                <div className="mt-3 space-y-2">
                  {availablePeople.slice(0, 6).map((person) => (
                    <button
                      key={person.id}
                      onClick={() => togglePerson(person.id)}
                      className="flex w-full items-center justify-between rounded-[1.5rem] bg-white/8 p-3 text-left active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar person={person} size="sm" />
                        <div>
                          <p className="text-sm font-semibold">{person.name}</p>
                          <p className="text-xs text-white/40">
                            {person.email}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">
                        Add
                      </span>
                    </button>
                  ))}

                  {availablePeople.length === 0 && (
                    <p className="rounded-[1.5rem] bg-white/8 px-4 py-3 text-sm text-white/45">
                      No available People found.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-4 rounded-[2rem] border border-red-300/20 bg-red-500/10 p-4">
            <p className="text-sm font-semibold text-red-100">Leave Circle</p>
            <p className="mt-1 text-xs leading-5 text-red-100/60">
              You will lose access to this Circle. Other members will still keep it.
            </p>

            {!confirmLeave ? (
              <button
                onClick={() => setConfirmLeave(true)}
                className="mt-4 w-full rounded-full bg-red-400/20 px-5 py-4 font-semibold text-red-100 active:scale-[0.98]"
              >
                Leave Circle
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="rounded-full bg-white/10 px-5 py-4 font-semibold text-white/65 active:scale-[0.98]"
                >
                  Cancel
                </button>

                <button
                  onClick={() => onLeave(circle.id)}
                  className="rounded-full bg-red-300 px-5 py-4 font-semibold text-red-950 active:scale-[0.98]"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>

          <div className="h-8" />
        </div>

        <div className="shrink-0 border-t border-white/10 bg-slate-950/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-2xl">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
              canSave ? "bg-white text-slate-950" : "bg-white/10 text-white/30"
            }`}
          >
            Save Circle
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({
  currentUser,
  onClose,
  onUpdateProfile,
  onChangePassword,
  onSignOut,
}: {
  currentUser: CurrentUser;
  onClose: () => void;
  onUpdateProfile: (profile: {
  name: string;
  avatarColor: string;
  status: string;
  avatarFile?: File;
}) => Promise<void>;
  onChangePassword: (newPassword: string) => Promise<void>;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(currentUser.name);
  const [status, setStatus] = useState(currentUser.status || "");
  const [avatarColor, setAvatarColor] = useState(currentUser.avatarColor);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(currentUser.avatarUrl || "");
const [avatarFile, setAvatarFile] = useState<File | undefined>();

  const passwordReady =
    newPassword.length >= 6 && newPassword === confirmPassword;

    function handleAvatarSelect(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  setAvatarFile(file);
  setAvatarPreviewUrl(URL.createObjectURL(file));
}

  async function saveProfile() {
    setError("");
    setMessage("");
    setSavingProfile(true);

    try {
      await onUpdateProfile({
        name,
        avatarColor,
        status,
        avatarFile,
      });

      setMessage("Profile updated.");
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Could not update profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (!passwordReady) return;

    setError("");
    setMessage("");
    setSavingPassword(true);

    try {
      await onChangePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "Could not update password. You may need to sign out and sign in again first."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[240] overflow-hidden bg-slate-950/80 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-h-full w-full max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black">
        <div className="shrink-0 border-b border-white/10 bg-slate-950/80 p-4 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">Profile</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Your account.
              </h2>
            </div>

            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <div className="flex items-center gap-4">
              <label className="relative grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-full shadow-xl shadow-black/30 ring-2 ring-white/20 active:scale-95">
  {avatarPreviewUrl ? (
    <img
      src={avatarPreviewUrl}
      alt="Profile avatar"
      className="h-full w-full object-cover"
    />
  ) : (
    <div
      className={`grid h-full w-full place-items-center bg-gradient-to-br ${avatarColor} text-xl font-black text-slate-950`}
    >
      {getInitials(name) || currentUser.initials}
    </div>
  )}

  <input
    type="file"
    accept="image/*"
    onChange={handleAvatarSelect}
    className="hidden"
  />

  <div className="absolute inset-x-0 bottom-0 bg-slate-950/65 py-1 text-center text-[10px] font-semibold text-white">
    Edit
  </div>
</label>

              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{name}</p>
                <p className="truncate text-sm text-white/45">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="text-sm text-white/60">Display name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/60">Status</label>
              <input
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                placeholder="Free this weekend, low battery, planning mode..."
                className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/60">Avatar style</label>
              <div className="mt-3 grid grid-cols-4 gap-3">
                {avatarColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setAvatarColor(color)}
                    className={`grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br ${color} text-xs font-black text-slate-950 shadow-lg shadow-black/25 active:scale-95 ${
                      avatarColor === color ? "ring-4 ring-white/70" : "ring-2 ring-white/10"
                    }`}
                  >
                    {getInitials(name) || currentUser.initials}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="mt-5 w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 active:scale-[0.98]"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>

          <div className="mt-4 rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-sm font-semibold text-white/75">Change password</p>
            <p className="mt-1 text-xs leading-5 text-white/40">
              Firebase may ask you to sign in again before changing your password.
            </p>

            <div className="mt-4">
              <label className="text-sm text-white/60">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 6 characters"
                className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/60">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>

            <button
              onClick={savePassword}
              disabled={!passwordReady || savingPassword}
              className={`mt-5 w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
                passwordReady
                  ? "bg-white text-slate-950"
                  : "bg-white/10 text-white/30"
              }`}
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>

          {(message || error) && (
            <div
              className={`mt-4 rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${
                error
                  ? "border border-red-300/20 bg-red-500/10 text-red-100"
                  : "border border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {error || message}
            </div>
          )}

          <button
            onClick={onSignOut}
            className="mt-4 w-full rounded-full bg-white/10 px-5 py-4 font-semibold text-white/65 active:scale-[0.98]"
          >
            Sign out
          </button>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

function AuthScreen({
  onAuthSubmit,
  authError,
}: {
  onAuthSubmit: (
    mode: "sign-in" | "sign-up",
    name: string,
    email: string,
    password: string
  ) => void;
  authError: string;
}) {
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [name, setName] = useState("Brandon");
  const [email, setEmail] = useState("brandon@email.com");
  const [password, setPassword] = useState("");

  const canContinue =
    email.trim().includes("@") &&
    password.length >= 6 &&
    (authMode === "sign-in" || name.trim().length > 1);

  function handleContinue() {
    if (!canContinue) return;
    onAuthSubmit(authMode, authMode === "sign-in" ? "User" : name, email, password);
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.28),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(217,70,239,0.24),transparent_30%),radial-gradient(circle_at_45%_80%,rgba(249,115,22,0.16),transparent_32%)]" />
      <div className="pointer-events-none fixed inset-0 backdrop-blur-3xl" />

      <section className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden border-x border-white/10 bg-slate-950/55 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] shadow-2xl shadow-black">
        <div className="mt-3 rounded-[3rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-lg font-black text-slate-950">
              C
            </div>

            <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs text-white/60">
              Private beta
            </div>
          </div>

          <h1 className="mt-8 text-5xl font-semibold leading-[0.95] tracking-tight">
            Circles
          </h1>

          <p className="mt-4 text-lg leading-8 text-white/65">
            Stay close with your people, coordinate plans, and invite trusted guests without opening your whole social world.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-2 rounded-full bg-white/8 p-2">
            <button
              onClick={() => setAuthMode("sign-up")}
              className={`rounded-full px-4 py-3 text-sm font-semibold active:scale-95 ${
                authMode === "sign-up" ? "bg-white text-slate-950" : "text-white/55"
              }`}
            >
              Sign up
            </button>

            <button
              onClick={() => setAuthMode("sign-in")}
              className={`rounded-full px-4 py-3 text-sm font-semibold active:scale-95 ${
                authMode === "sign-in" ? "bg-white text-slate-950" : "text-white/55"
              }`}
            >
              Sign in
            </button>
          </div>
        </div>

        <div className="mt-5 flex-1 overflow-y-auto rounded-[3rem] border border-white/10 bg-white/8 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <p className="text-sm text-white/45">
            {authMode === "sign-up" ? "Create your account" : "Welcome back"}
          </p>

          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {authMode === "sign-up" ? "Start your private orbit." : "Return to your Circles."}
          </h2>

          <div className="mt-6 space-y-4">
            {authMode === "sign-up" && (
              <div>
                <label className="text-sm text-white/60">Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
                />
              </div>
            )}

            <div>
              <label className="text-sm text-white/60">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-sm text-white/60">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>
          </div>

          {authError && (
            <div className="mt-5 rounded-[1.5rem] border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
              {authError}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`mt-6 w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
              canContinue ? "bg-white text-slate-950" : "bg-white/10 text-white/30"
            }`}
          >
            {authMode === "sign-up" ? "Create account" : "Sign in"}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-white/35">
            Your profile and Circles are saved securely.
          </p>
        </div>
      </section>
    </main>
  );
}

function Header({
  circle,
  activeTab,
  currentUser,
  onOpenProfile,
  onOpenCircleSettings,
}: {
  circle: Circle | null;
  activeTab: ActiveTab;
  currentUser: CurrentUser;
  onOpenProfile: () => void;
  onOpenCircleSettings: () => void;
}) {
  const isCircleDetail = activeTab === "circleDetail" && circle;

  const headerTitle =
    isCircleDetail
      ? circle.name
      : activeTab === "orbit"
        ? "Your Orbit"
        : activeTab === "circles"
          ? "Circles"
          : activeTab === "loops"
            ? "Loops"
            : `Welcome ${getFirstName(currentUser.name)}`;

  const headerEyebrow =
    isCircleDetail
      ? "Circle"
      : activeTab === "orbit"
        ? "Briefing"
        : activeTab === "circles"
          ? "Your groups"
          : activeTab === "loops"
            ? "Planning hub"
            : "Home";

  return (
    <header className="relative z-10 px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm text-white/45">{headerEyebrow}</p>

          <h1 className="truncate text-3xl font-semibold tracking-tight">
            {headerTitle}
          </h1>
        </div>

        {isCircleDetail ? (
          <button onClick={onOpenCircleSettings} className="active:scale-95">
            <CircleVisual circle={circle} size="sm" />
          </button>
        ) : (
          <button
            onClick={onOpenProfile}
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-black text-white ring-2 ring-white/15 active:scale-95"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="h-full w-full object-cover"
              />
            ) : (
              currentUser.initials
            )}
          </button>
        )}
      </div>
    </header>
  );
}

function LoopsDashboardView({
  circles,
  currentUser,
  selectedLoopId,
  onOpenCircle,
  onOpenLoop,
  onVotePoll,
  onToggleTask,
}: {
  circles: Circle[];
  currentUser: CurrentUser;
  selectedLoopId: string;
  onOpenCircle: (circleId: string) => void;
  onOpenLoop: (circleId: string, loopId: string) => void;
  onVotePoll: (
    circleId: string,
    loopId: string,
    optionId: string,
    personName: string
  ) => void;
  onToggleTask: (circleId: string, loopId: string, taskId: string) => void;
}) {
  const [filter, setFilter] = useState<"All" | "This Week" | "Polls" | "Tasks">("All");

  const allLoops = circles.flatMap((circle) =>
    circle.loop
      .filter((loop) => !loop.archived)
      .map((loop) => ({
        circle,
        loop,
      }))
  );

  const filteredLoops = allLoops
    .filter(({ loop }) => {
      if (filter === "This Week") return isLoopComingSoon(loop);
      if (filter === "Polls") return Boolean(loop.poll);
      if (filter === "Tasks") return loop.tasks.length > 0;
      return true;
    })
    .sort((a, b) => {
      if (a.loop.id === selectedLoopId) return -1;
      if (b.loop.id === selectedLoopId) return 1;

      const dateA = a.loop.timing.date || "9999-99-99";
      const dateB = b.loop.timing.date || "9999-99-99";

      return dateA.localeCompare(dateB);
    });

  return (
    <div className="space-y-5">
      <div className="px-1">
        <h2 className="text-2xl font-semibold tracking-tight">Loops</h2>
        <p className="mt-1 text-sm text-white/45">
          Plans, polls, tasks, and decisions across your Circles.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["All", "This Week", "Polls", "Tasks"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold active:scale-95 ${
              filter === item
                ? "bg-white text-slate-950"
                : "bg-white/8 text-white/55"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredLoops.map(({ circle, loop }) => {
          const isSelected = loop.id === selectedLoopId;
          const userVotes =
            loop.poll?.options.flatMap((option) =>
              option.votes.includes(currentUser.name) ? [option.id] : []
            ) || [];

          return (
            <div
              key={`${circle.id}-${loop.id}`}
              className={`rounded-[2rem] border p-4 shadow-xl shadow-black/20 backdrop-blur-2xl ${
                isSelected
                  ? "border-cyan-200/40 bg-cyan-300/12"
                  : "border-white/10 bg-white/8"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-white/40">{circle.name}</p>
                  <h3 className="mt-1 truncate text-xl font-semibold">
                    {loop.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/45">
                    {getLoopTimingLabelForOrbit(loop.timing)}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
                  {loop.type}
                </span>
              </div>

              {loop.quickNote && (
                <p className="mt-4 rounded-[1.5rem] bg-white/8 px-4 py-3 text-sm leading-6 text-white/55">
                  {loop.quickNote}
                </p>
              )}

              {loop.poll && (
                <div className="mt-4 rounded-[1.5rem] bg-white/8 p-4">
                  <p className="text-sm font-semibold">{loop.poll.question}</p>

                  <div className="mt-3 space-y-2">
                    {loop.poll.options.map((option) => {
                      const selected = userVotes.includes(option.id);

                      return (
                        <button
                          key={option.id}
                          onClick={() =>
                            onVotePoll(
                              circle.id,
                              loop.id,
                              option.id,
                              currentUser.name
                            )
                          }
                          className={`flex w-full items-center justify-between rounded-full px-4 py-3 text-sm active:scale-[0.98] ${
                            selected
                              ? "bg-white text-slate-950"
                              : "bg-white/10 text-white/65"
                          }`}
                        >
                          <span>{option.label}</span>
                          <span>{option.votes.length}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {loop.tasks.length > 0 && (
                <div className="mt-4 rounded-[1.5rem] bg-white/8 p-4">
                  <p className="text-sm font-semibold">Tasks</p>

                  <div className="mt-3 space-y-2">
                    {loop.tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onToggleTask(circle.id, loop.id, task.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-[1.25rem] bg-white/8 px-4 py-3 text-left active:scale-[0.98]"
                      >
                        <div className="min-w-0">
                          <p
                            className={`truncate text-sm ${
                              task.done ? "text-white/35 line-through" : "text-white/75"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            Owner: {task.owner}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
                          {task.done ? "Done" : "Open"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOpenLoop(circle.id, loop.id)}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white/65 active:scale-[0.98]"
                >
                  Focus Loop
                </button>

                <button
                  onClick={() => onOpenCircle(circle.id)}
                  className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 active:scale-[0.98]"
                >
                  Open Circle
                </button>
              </div>
            </div>
          );
        })}

        {filteredLoops.length === 0 && (
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5 text-center">
            <h3 className="text-xl font-semibold">No Loops here.</h3>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Create a Loop inside a Circle to start planning.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CirclesView({
  circles,
  selectedCircleId,
  onOpenCircle,
  onCreateCircle,
}: {
  circles: Circle[];
  selectedCircleId: string;
  onOpenCircle: (circleId: string) => void;
  onCreateCircle: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
  "All" | "Active" | "Loops" | "Quiet" | "Upcoming"
>("All");

  const filteredCircles = circles.filter((circle) => {
    const matchesSearch = circle.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const activePosts = getActivePosts(circle);
    const activeLoops = circle.loop.filter((item) => !item.archived);
    const upcomingLoops = activeLoops.filter(isLoopComingSoon);

    const matchesFilter =
  filter === "All" ||
  (filter === "Active" && activePosts.length > 0) ||
  (filter === "Loops" && activeLoops.length > 0) ||
  (filter === "Upcoming" && upcomingLoops.length > 0) ||
  (filter === "Quiet" && activePosts.length === 0 && activeLoops.length === 0);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Circles</h2>
          <p className="mt-1 text-sm text-white/45">
            Find and open the groups you run in.
          </p>
        </div>

        <button
          onClick={onCreateCircle}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 active:scale-95"
        >
          Create
        </button>
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search Circles"
        className="w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["All", "Active", "Loops", "Upcoming", "Quiet"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold active:scale-95 ${
              filter === item
                ? "bg-white text-slate-950"
                : "bg-white/8 text-white/55"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredCircles.map((circle) => {
         const activePosts = getActivePosts(circle);
        const activeLoops = circle.loop.filter((item) => !item.archived);
        const upcomingLoops = activeLoops.filter(isLoopComingSoon);
        const hasActivity = activePosts.length > 0 || activeLoops.length > 0;
        const attentionScore = getCircleAttentionScore(circle);
        const attentionLabel = getCircleAttentionLabel(attentionScore);

          return (
            <button
              key={circle.id}
              onClick={() => onOpenCircle(circle.id)}
              className={`w-full rounded-[2rem] border p-4 text-left shadow-xl backdrop-blur-2xl transition active:scale-[0.98] ${
                selectedCircleId === circle.id
                  ? "border-white/25 bg-white/14 shadow-black/25"
                  : hasActivity
                    ? "border-cyan-200/25 bg-cyan-300/10 shadow-cyan-950/30"
                    : "border-white/10 bg-white/8 shadow-black/25"
              }`}
            >
              <div className="flex items-center gap-4">
                <CircleVisual circle={circle} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">
                      {circle.name}
                    </h3>

                    {hasActivity && (
                      <span className="grid h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-200 shadow-lg shadow-cyan-300/40" />
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
  <span>{activeLoops.length} active Loops</span>
  <span>•</span>
  <span>{circle.members.length}/8 people</span>
  {upcomingLoops.length > 0 && (
    <>
      <span>•</span>
      <span>{upcomingLoops.length} coming soon</span>
    </>
  )}
</div>

<div className="mt-3 flex items-center justify-between gap-3">
  <div className="flex items-center">
    {circle.members.slice(0, 5).map((person, index) => (
      <div
        key={person.id}
        className="-ml-2 first:ml-0"
        style={{ zIndex: 10 - index }}
      >
        <Avatar person={person} size="sm" />
      </div>
    ))}
  </div>

  {attentionLabel && (
    <span className="shrink-0 rounded-full bg-cyan-200 px-3 py-1 text-[11px] font-semibold text-slate-950">
      {attentionLabel}
    </span>
  )}
</div>
                </div>
              </div>
            </button>
          );
        })}

        {filteredCircles.length === 0 && (
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5 text-center">
            <h3 className="text-xl font-semibold">No Circles found.</h3>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Try a different search or filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function OrbitBriefView({
  circles,
  currentUser,
  incomingRequests,
  onOpenCircle,
  onOpenLoop,
  onOpenPeople,
}: {
  circles: Circle[];
  currentUser: CurrentUser;
  incomingRequests: FriendRequest[];
  onOpenCircle: (circleId: string) => void;
  onOpenLoop: (circleId: string, loopId: string) => void;
  onOpenPeople: () => void;
}) {
  const orbitBrief = useMemo(
    () => calculateOrbitBrief(circles, currentUser, incomingRequests),
    [circles, currentUser, incomingRequests]
  );

  const modeGradient =
    orbitBrief.modeName === "Travel Bug"
      ? "from-orange-300 via-rose-500 to-fuchsia-700"
      : orbitBrief.modeName === "The Planner"
        ? "from-cyan-300 via-blue-500 to-indigo-800"
        : orbitBrief.modeName === "Decision Point"
          ? "from-yellow-200 via-orange-500 to-red-700"
          : orbitBrief.modeName === "Booked & Busy"
            ? "from-fuchsia-300 via-purple-500 to-indigo-800"
            : orbitBrief.modeName === "Social Butterfly"
              ? "from-lime-200 via-emerald-400 to-cyan-700"
              : orbitBrief.modeName === "Catch Up Crew"
                ? "from-amber-200 via-orange-400 to-rose-700"
                : orbitBrief.modeName === "Inner Circle"
                  ? "from-rose-200 via-purple-500 to-indigo-900"
                  : "from-slate-200 via-slate-400 to-slate-800";

  function handleNeedClick(need: OrbitNeed) {
  if (need.destination === "loops" && need.circleId && need.loopId) {
    onOpenLoop(need.circleId, need.loopId);
    return;
  }

  if (need.destination === "circle" && need.circleId) {
    onOpenCircle(need.circleId);
    return;
  }

  if (need.destination === "people") {
    onOpenPeople();
  }
}

  return (
    <div className="space-y-5">
      <div className={`relative overflow-hidden rounded-[2.75rem] border border-white/10 bg-gradient-to-br ${modeGradient} p-5 shadow-2xl shadow-black/30`}>
        <div className="absolute inset-0 bg-slate-950/25" />
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-14 left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <p className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold text-white/75">
              Orbit Brief
            </p>

            <p className="rounded-full bg-slate-950/25 px-3 py-1 text-xs font-semibold text-white/75">
              Now
            </p>
          </div>

          <h2 className="mt-7 text-4xl font-semibold leading-[0.95] tracking-tight">
            {orbitBrief.modeName}
          </h2>

          <p className="mt-3 text-lg font-medium text-white/85">
            {orbitBrief.modeSubtitle}
          </p>

          <p className="mt-3 text-sm leading-6 text-white/70">
            {orbitBrief.reason}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {orbitBrief.stats.map((stat) => (
              <span
                key={stat}
                className="rounded-full bg-white/18 px-3 py-2 text-xs font-semibold text-white/80"
              >
                {stat}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-xl shadow-black/20 backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-white/35">
          Next move
        </p>

        <h3 className="mt-2 text-xl font-semibold">
          {orbitBrief.nextMoveTitle}
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/50">
          {orbitBrief.nextMoveDetail}
        </p>

        {orbitBrief.nextMoveDestination && (
  <button
    onClick={() => {
      if (
        orbitBrief.nextMoveDestination === "loops" &&
        orbitBrief.nextMoveCircleId &&
        orbitBrief.nextMoveLoopId
      ) {
        onOpenLoop(orbitBrief.nextMoveCircleId, orbitBrief.nextMoveLoopId);
        return;
      }

      if (
        orbitBrief.nextMoveDestination === "circle" &&
        orbitBrief.nextMoveCircleId
      ) {
        onOpenCircle(orbitBrief.nextMoveCircleId);
        return;
      }

      if (orbitBrief.nextMoveDestination === "people") {
        onOpenPeople();
      }
    }}
    className="mt-4 w-full rounded-full bg-white px-5 py-4 text-sm font-semibold text-slate-950 active:scale-[0.98]"
  >
    Go there
  </button>
)}
      </div>

      {orbitBrief.needs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-semibold">Needs You</h3>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/45">
              {orbitBrief.needs.length}
            </span>
          </div>

          <div className="space-y-2">
            {orbitBrief.needs.map((need) => (
              <button
                key={need.id}
                onClick={() => handleNeedClick(need)}
                className="flex w-full items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/8 p-4 text-left active:scale-[0.98]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{need.title}</p>
                  <p className="mt-1 truncate text-xs text-white/45">
                    {need.detail}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
                  {need.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {orbitBrief.hotCircles.length > 0 && (
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-lg font-semibold">Hot Right Now</h3>
          </div>

          <div className="space-y-2">
            {orbitBrief.hotCircles.map(({ circle, reason, score }) => (
              <button
                key={circle.id}
                onClick={() => onOpenCircle(circle.id)}
                className="flex w-full items-center gap-4 rounded-[1.75rem] border border-white/10 bg-white/8 p-4 text-left shadow-lg shadow-black/15 active:scale-[0.98]"
              >
                <div className={score >= 12 ? "scale-110" : score >= 6 ? "scale-105" : ""}>
                  <CircleVisual circle={circle} size="sm" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {circle.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-white/45">
                    {reason}
                  </p>
                </div>

                <span className="grid h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-lg shadow-cyan-300/40" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-xl shadow-black/20 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Your Mix</h3>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/45">
            This week
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {orbitBrief.mix.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/75">{item.label}</span>
                <span className="text-white/45">{item.value}%</span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-white/70"
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {circles.length === 0 && (
        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5 text-center">
          <h3 className="text-xl font-semibold">Your Orbit is empty.</h3>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Once you create Circles, posts, and Loops, this page will show what needs your attention.
          </p>
        </div>
      )}
    </div>
  );
}

function HomeView({
  circles,
  onOpenCircle,
  selectedCircleId,
  onCreateCircle,
  onViewAllCircles,
}: {
  circles: Circle[];
  guestPassCount: number;
  currentUser: CurrentUser;
  onOpenCircle: (circleId: string) => void;
  selectedCircleId: string;
  setSelectedCircleId: (circleId: string) => void;
  onCreateCircle: () => void;
  onOpenProfile: () => void;
  onViewAllCircles: () => void;
}) {
  const visibleCircles = circles.slice(0, 3);
  const comingSoonLoops = getComingSoonLoops(circles);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold tracking-tight">Your Circles</h2>

        <button
          onClick={onCreateCircle}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 active:scale-95"
        >
          Create
        </button>
      </div>

      {visibleCircles.length === 0 ? (
        <div className="rounded-[2.25rem] border border-white/10 bg-white/8 p-5 text-center shadow-xl shadow-black/20 backdrop-blur-2xl">
          <h3 className="text-xl font-semibold">No Circles yet.</h3>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Create a small private space for your people.
          </p>
          <button
            onClick={onCreateCircle}
            className="mt-5 w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 active:scale-[0.98]"
          >
            Create a Circle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCircles.map((circle) => {
            const activePosts = getActivePosts(circle);
            const activeLoops = circle.loop.filter((item) => !item.archived);
            const hasNewActivity = activePosts.length > 0 || activeLoops.length > 0;

            return (
              <button
                key={circle.id}
                onClick={() => onOpenCircle(circle.id)}
                className={`w-full rounded-[2rem] border p-4 text-left shadow-xl backdrop-blur-2xl transition active:scale-[0.98] ${
                  selectedCircleId === circle.id
                    ? "border-white/25 bg-white/14 shadow-black/25"
                    : hasNewActivity
                      ? "border-cyan-200/25 bg-cyan-300/10 shadow-cyan-950/30"
                      : "border-white/10 bg-white/8 shadow-black/25"
                }`}
              >
                <div className="flex items-center gap-4">
                  <CircleVisual circle={circle} size="md" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold">
                        {circle.name}
                      </h3>

                      {hasNewActivity && (
                        <span className="grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full bg-cyan-200 shadow-lg shadow-cyan-300/40" />
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                      <span>{activeLoops.length} active Loops</span>
                      <span>•</span>
                      <span>{circle.members.length}/8 people</span>
                    </div>

                    <div className="mt-3 flex items-center">
                      {circle.members.slice(0, 5).map((person, index) => (
                        <div
                          key={person.id}
                          className="-ml-2 first:ml-0"
                          style={{ zIndex: 10 - index }}
                        >
                          <Avatar person={person} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

{circles.length > 3 && (
  <button
    onClick={onViewAllCircles}
    className="w-full rounded-full border border-white/10 bg-white/8 px-5 py-4 text-sm font-semibold text-white/65 active:scale-[0.98]"
  >
    View all Circles
  </button>
)}
        </div>
      )}

      {comingSoonLoops.length > 0 && (
        <div className="space-y-3">
          <div className="px-1">
            <h2 className="text-lg font-semibold tracking-tight">Coming Soon</h2>
          </div>

          <div className="space-y-2">
            {comingSoonLoops.map((loop) => (
              <button
                key={`${loop.circleId}-${loop.id}`}
                onClick={() => onOpenCircle(loop.circleId)}
                className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/8 px-4 py-3 text-left active:scale-[0.98]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{loop.title}</p>
                  <p className="mt-1 truncate text-xs text-white/40">
                    {loop.circleName}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                  {loop.timing.date}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RepliesModal({
  post,
  person,
  onClose,
  onOpenReply,
}: {
  post: Post;
  person?: Person | null;
  onClose: () => void;
  onOpenReply: () => void;
}) {
  const replies = post.replies || [];

  return (
    <div className="fixed inset-0 z-[275] bg-slate-950/80 px-4 py-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-2xl">
      <div className="mx-auto flex h-[calc(100%-1.5rem)] max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black">
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">Replies</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                {post.personName}'s post
              </h2>
            </div>

            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4">
            <div className="flex items-center gap-3">
              {person ? (
                <Avatar person={person} size="sm" />
              ) : (
                <div className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${post.personColor} text-xs font-black text-slate-950`}>
                  {post.personInitials}
                </div>
              )}

              <div>
                <p className="text-sm font-semibold">{post.personName}</p>
                <p className="text-xs text-white/40">{post.time}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-white/70">
              {post.caption || "No caption."}
            </p>

            {post.photoUrl && (
              <img
                src={post.photoUrl}
                alt={`${post.personName} post`}
                className="mt-4 max-h-72 w-full rounded-[1.5rem] object-cover"
              />
            )}
          </div>

          <div className="mt-4 space-y-3">
            {replies.length > 0 ? (
              replies.map((reply) => (
                <div
                  key={reply.id}
                  className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{reply.userName}</p>
                    <p className="text-xs text-white/35">{reply.createdAt}</p>
                  </div>

                  {reply.text && (
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      {reply.text}
                    </p>
                  )}

                  {reply.imageUrl && (
                    <img
                      src={reply.imageUrl}
                      alt={`${reply.userName} reply`}
                      className="mt-3 max-h-80 w-full rounded-[1.25rem] object-cover"
                    />
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] bg-white/8 p-5 text-center">
                <p className="text-sm font-semibold text-white/70">
                  No replies yet.
                </p>
                <p className="mt-1 text-xs text-white/35">
                  Be the first to respond.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onOpenReply}
            className="w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 active:scale-[0.98]"
          >
            Add Reply
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplyComposerModal({
  post,
  onClose,
  onSubmit,
}: {
  post: Post;
  onClose: () => void;
  onSubmit: (text: string, imageFile?: File) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [isSending, setIsSending] = useState(false);

  const canSend = text.trim().length > 0 || Boolean(imageFile);

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (!canSend || isSending) return;

    setIsSending(true);

    try {
      await onSubmit(text, imageFile);
      setText("");
      setImageFile(undefined);
      setImagePreviewUrl("");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[280] bg-slate-950/80 px-4 py-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-2xl">
      <div className="mx-auto flex h-[calc(100%-1.5rem)] max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black">
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">Replying to {post.personName}</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Add a reply.
              </h2>
            </div>

            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="rounded-[1.75rem] bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">
              Original post
            </p>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/65">
              {post.caption || "No caption."}
            </p>
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a reply"
            className="mt-4 min-h-[150px] w-full resize-none rounded-[1.75rem] border border-white/10 bg-white/10 px-4 py-4 text-base leading-6 text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />

          <label className="mt-4 block cursor-pointer rounded-[1.75rem] border border-dashed border-white/15 bg-white/8 p-4 text-center active:scale-[0.99]">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Reply preview"
                className="h-52 w-full rounded-[1.4rem] object-cover"
              />
            ) : (
              <div className="py-8">
                <p className="text-sm font-semibold text-white/70">
                  Add image reply
                </p>
                <p className="mt-1 text-xs text-white/35">
                  Optional, but useful for photos, screenshots, or context.
                </p>
              </div>
            )}
          </label>

          {imagePreviewUrl && (
            <button
              onClick={() => {
                setImageFile(undefined);
                setImagePreviewUrl("");
              }}
              className="mt-3 w-full rounded-full bg-white/8 px-4 py-3 text-sm font-semibold text-white/45 active:scale-95"
            >
              Remove image
            </button>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <button
            onClick={handleSubmit}
            disabled={!canSend || isSending}
            className={`w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
              canSend && !isSending
                ? "bg-white text-slate-950"
                : "bg-white/10 text-white/30"
            }`}
          >
            {isSending ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectedPostCard({
  post,
  person,
  currentUserId,
  onReact,
  onOpenReply,
  onOpenReplies,
}: {
  post: Post;
  person?: Person | null;
  currentUserId: string;
  onReact: (emoji?: string) => void;
  onOpenReply: () => void;
  onOpenReplies: () => void;
}) {
  const reactions = post.reactions || [];
  const replies = post.replies || [];
  const topReplies = replies.slice(0, 2);
  const hiddenReplyCount = Math.max(0, replies.length - topReplies.length);
  const imageReply = replies.find((reply) => reply.imageUrl);

  const reactionOptions = ["❤️", "✨", "😂", "👀"];

  function getReactionCount(emoji: string) {
    return reactions.filter((reaction) => reaction.emoji === emoji).length;
  }

  function hasReacted(emoji: string) {
    return reactions.some(
      (reaction) => reaction.emoji === emoji && reaction.userId === currentUserId
    );
  }

  return (
    <div className="rounded-[2.25rem] bg-white/[0.06] p-3 shadow-inner shadow-white/5">
      <div className="grid grid-cols-[40%_1fr] gap-3">
        <div className="min-w-0">
          <div
            className={`relative aspect-[0.95] overflow-hidden rounded-[56%_42%_48%_38%/42%_56%_44%_58%] border border-cyan-200/50 bg-gradient-to-br ${post.gradient} shadow-xl shadow-black/25`}
          >
            {post.photoUrl ? (
              <img
                src={post.photoUrl}
                alt={`${post.personName} post`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <div
                  className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${post.personColor} text-lg font-black text-slate-950 shadow-xl shadow-black/25`}
                >
                  {post.personInitials}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {person ? (
              <Avatar person={person} size="sm" />
            ) : (
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${post.personColor} text-xs font-black text-slate-950`}
              >
                {post.personInitials}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{post.personName}</p>
              <p className="text-[11px] leading-4 text-white/40">
                {post.time}
              </p>
              <p className="text-[11px] leading-4 text-white/40">
                {getPostExpirationLabel(post)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {reactionOptions.map((emoji) => {
              const count = getReactionCount(emoji);
              const active = hasReacted(emoji);

              return (
                <button
                  key={emoji}
                  onClick={() => onReact(emoji)}
                  className={`h-9 rounded-full px-2 text-xs font-semibold active:scale-95 ${
                    active
                      ? "bg-white text-slate-950"
                      : "bg-white/10 text-white/65"
                  }`}
                >
                  {emoji} {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
            Post
          </p>

          <p className="mt-2 line-clamp-4 text-sm leading-5 text-white/85">
            {post.caption || "No caption yet."}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
              Replies
            </p>

            {replies.length > 0 && (
              <button
                onClick={onOpenReplies}
                className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/45 active:scale-95"
              >
                View all
              </button>
            )}
          </div>

          <div className="mt-2 space-y-2">
            {topReplies.length > 0 ? (
              topReplies.map((reply) => (
                <button
                  key={reply.id}
                  onClick={onOpenReplies}
                  className="w-full rounded-[1.2rem] bg-white/8 px-3 py-2 text-left active:scale-[0.99]"
                >
                  <p className="truncate text-[11px] font-semibold text-white/55">
                    {reply.userName}
                  </p>

                  {reply.text && (
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-white/75">
                      {reply.text}
                    </p>
                  )}

                  {reply.imageUrl && (
                    <img
                      src={reply.imageUrl}
                      alt={`${reply.userName} reply`}
                      className="mt-2 h-14 w-full rounded-[0.9rem] object-cover"
                    />
                  )}
                </button>
              ))
            ) : (
              <p className="rounded-[1.2rem] bg-white/8 px-3 py-3 text-xs leading-5 text-white/40">
                No replies yet.
              </p>
            )}

            {hiddenReplyCount > 0 && (
              <button
                onClick={onOpenReplies}
                className="text-xs font-semibold text-white/45 active:scale-95"
              >
                View {hiddenReplyCount} more
              </button>
            )}

            {imageReply?.imageUrl && topReplies.every((reply) => !reply.imageUrl) && (
              <button
                onClick={onOpenReplies}
                className="relative h-16 w-full overflow-hidden rounded-[1.25rem] border border-white/10 active:scale-[0.99]"
              >
                <img
                  src={imageReply.imageUrl}
                  alt="Reply preview"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-950/25" />
                <div className="absolute bottom-2 left-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-950">
                  Image reply
                </div>
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={onOpenReply}
              className="h-12 rounded-full bg-white text-sm font-semibold text-slate-950 active:scale-95"
            >
              Reply
            </button>

            <button
              onClick={onOpenReplies}
              className="h-12 rounded-full bg-white/10 text-sm font-semibold text-white/65 active:scale-95"
            >
              View All
            </button>
          </div>

          <button className="mt-3 text-xs font-semibold text-white/25">
            Report post
          </button>
        </div>
      </div>
    </div>
  );
}

function OrbitView({
  circle,
  currentUserId,
  selectedPostIndex,
  setSelectedPostIndex,
  onOpenAddUpdate,
  onOpenCreateLoop,
  onArchiveLoop,
  onOpenCircleSettings,
  onSetParticipation,
  onVotePoll,
  onToggleTask,
  onOpenGuestPass,
  onReactToPost,
  onReplyToPost,
}: {
  circle: Circle;
  currentUserId: string;
  selectedPostIndex: number;
  setSelectedPostIndex: (index: number) => void;
  onOpenAddUpdate: () => void;
  onOpenCreateLoop: () => void;
  onOpenCircleSettings: () => void;
  onArchiveLoop: (loopId: string) => void;
  onSetParticipation: (loopId: string, personName: string, status: ParticipationStatus) => void;
  onVotePoll: (loopId: string, optionId: string, personName: string) => void;
  onToggleTask: (loopId: string, taskId: string) => void;
  onOpenGuestPass: (circleId: string, loopId: string) => void;
  onReactToPost: (postId: string, emoji: string) => void;
  onReplyToPost: (postId: string, text: string, imageFile?: File) => void | Promise<void>;
}) {
  const posts = circle.posts;
  const selectedPost = posts[selectedPostIndex] || posts[0];
const selectedPerson: Person | null = selectedPost
  ? {
      id: selectedPost.personId,
      name: selectedPost.personName,
      initials: selectedPost.personInitials,
      color: selectedPost.personColor,
      status: "Friend",
      avatarUrl: selectedPost.personAvatarUrl,
    }
  : null;
  const dialStep = posts.length ? 360 / posts.length : 0;
  const [circularDialAngle, setCircularDialAngle] = useState(0);
  const [orbitMode, setOrbitMode] = useState<"updates" | "loop">("updates");
const [touchStartX, setTouchStartX] = useState<number | null>(null);
const [isReplyComposerOpen, setIsReplyComposerOpen] = useState(false);
const [isRepliesOpen, setIsRepliesOpen] = useState(false);
const [touchStartY, setTouchStartY] = useState<number | null>(null);
const [dragOffsetX, setDragOffsetX] = useState(0);
const [isDraggingOrbit, setIsDraggingOrbit] = useState(false);
const [isHorizontalOrbitDrag, setIsHorizontalOrbitDrag] = useState(false);
const [customEmoji, setCustomEmoji] = useState("");
const [replyText, setReplyText] = useState("");

const modeSwitcher = (
  <div className="grid grid-cols-2 gap-2">
    <button
      onClick={() => {
        setOrbitMode("updates");
        onOpenAddUpdate();
      }}
      className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 active:scale-95"
    >
      Add Post
    </button>

    <button
      onClick={() => setOrbitMode("loop")}
      className={`rounded-full border border-white/10 px-4 py-3 text-sm font-semibold active:scale-95 ${
        orbitMode === "loop"
          ? "bg-white text-slate-950"
          : "bg-white/8 text-white/65"
      }`}
    >
      Manage Loops
    </button>
  </div>
);

function handleOrbitSwipeStart(startX: number, startY: number) {
  setTouchStartX(startX);
  setTouchStartY(startY);
  setDragOffsetX(0);
  setIsDraggingOrbit(false);
  setIsHorizontalOrbitDrag(false);
}

function handleOrbitSwipeMove(
  currentX: number,
  currentY: number,
  event?: React.TouchEvent<HTMLDivElement>
) {
  if (touchStartX === null || touchStartY === null) return;

  const deltaX = currentX - touchStartX;
  const deltaY = currentY - touchStartY;

  const isClearlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) + 12;

  if (!isClearlyHorizontal && !isHorizontalOrbitDrag) {
    return;
  }

  event?.preventDefault();

  setIsHorizontalOrbitDrag(true);
  setIsDraggingOrbit(true);

  const clampedOffset = Math.max(-120, Math.min(120, deltaX));
  setDragOffsetX(clampedOffset);
}

function handleOrbitSwipeEnd(endX: number) {
  if (touchStartX === null) return;

  const delta = touchStartX - endX;

  if (isHorizontalOrbitDrag && Math.abs(delta) > 45) {
    moveDial(delta > 0 ? "next" : "prev");
  }

  setTouchStartX(null);
  setTouchStartY(null);
  setDragOffsetX(0);
  setIsDraggingOrbit(false);
  setIsHorizontalOrbitDrag(false);
}

function addCustomEmojiReaction(emojiOverride?: string) {
  if (!selectedPost) return;

  const emojiToUse = emojiOverride || customEmoji.trim();
  if (!emojiToUse) return;

  onReactToPost(selectedPost.id, emojiToUse);
  setCustomEmoji("");
}

async function submitReply(text: string, imageFile?: File) {
  if (!selectedPost) return;

  await onReplyToPost(selectedPost.id, text, imageFile);
  setIsReplyComposerOpen(false);
}

function getMyReactionBadges(post: Post) {
  const reactions = post.reactions || [];

  return reactions
    .filter((reaction) => reaction.userId === currentUserId)
    .slice(0, 3)
    .map((reaction) => reaction.emoji);
}

  function moveDialAngleTo(targetAngle: number) {
  setCircularDialAngle((currentAngle) => {
    const currentNormalized = ((currentAngle % 360) + 360) % 360;
    let delta = targetAngle - currentNormalized;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    return currentAngle + delta;
  });
}

function choosePost(index: number) {
  setSelectedPostIndex(index);
  moveDialAngleTo(index * dialStep);
}

  function getDepthPosition(index: number) {
    const count = posts.length || 1;
    const step = (Math.PI * 2) / count;
    const dragProgress = posts.length > 1 ? dragOffsetX / 180 : 0;
const angle = step * (index - selectedPostIndex + dragProgress);

    const x = Math.sin(angle) * 128;
    const y = Math.cos(angle) * 46 + 46;

    const depth = Math.cos(angle);
    const normalizedDepth = (depth + 1) / 2;

    const scale = 0.62 + normalizedDepth * 0.48;
    const opacity = 0.42 + normalizedDepth * 0.58;
    const blur = depth < -0.15 ? 2.4 : depth < 0.2 ? 1.1 : 0;
    const zIndex = Math.round(normalizedDepth * 100);

    return {
      x,
      y,
      scale,
      opacity,
      blur,
      zIndex,
      isActive: index === selectedPostIndex,
      depth,
    };
  }

  function moveDial(direction: "prev" | "next") {
  if (!posts.length) return;

  if (direction === "prev") {
    const nextIndex = selectedPostIndex === 0 ? posts.length - 1 : selectedPostIndex - 1;
    setSelectedPostIndex(nextIndex);
    setCircularDialAngle((currentAngle) => currentAngle - dialStep);
  } else {
    const nextIndex = selectedPostIndex === posts.length - 1 ? 0 : selectedPostIndex + 1;
    setSelectedPostIndex(nextIndex);
    setCircularDialAngle((currentAngle) => currentAngle + dialStep);
  }
}

function handleCircularDial(event: PointerEvent<HTMLButtonElement>) {
  if (!posts.length) return;

  const dial = event.currentTarget;
  const rect = dial.getBoundingClientRect();

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const deltaX = event.clientX - centerX;
  const deltaY = event.clientY - centerY;

  const rawAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  const normalizedAngle = (rawAngle + 90 + 360) % 360;
  const nextIndex = Math.round((normalizedAngle / 360) * posts.length) % posts.length;

  moveDialAngleTo(normalizedAngle);
  setSelectedPostIndex(nextIndex);
}

if (orbitMode === "loop") {
 return (
  <div className="space-y-4">
    <div className="space-y-2">
      {modeSwitcher}
    </div>

    <LoopView
  circle={circle}
  onOpenCreateLoop={onOpenCreateLoop}
  onOpenCircleSettings={onOpenCircleSettings}
  onArchiveLoop={onArchiveLoop}
  onSetParticipation={onSetParticipation}
  onVotePoll={onVotePoll}
  onToggleTask={onToggleTask}
  onOpenGuestPass={onOpenGuestPass}
/>
    </div>
  );
}

  if (posts.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center">
        <div className="rounded-[3rem] border border-white/10 bg-white/8 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="flex justify-center">
  <CircleVisual circle={circle} size="lg" />
</div>

          <h2 className="mt-6 text-3xl font-semibold">No posts yet.</h2>

          <p className="mt-3 text-sm leading-6 text-white/55">
            Start the Circle with a quick post or create a Loop.
          </p>

          <button
            onClick={onOpenAddUpdate}
            className="mt-6 w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 active:scale-[0.98]"
          >
            Add Post
          </button>
        </div>
      </div>
    );
  }

return (
  <div className="space-y-4">
    <div className="space-y-2">
      {modeSwitcher}
    </div>

    <div className="relative overflow-hidden rounded-[2.75rem] border border-white/10 bg-slate-900/50 p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl">
  {selectedPost && (
    <div
      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${selectedPost.gradient} opacity-[0.18] blur-2xl transition-all duration-500`}
    />
  )}

  <div className="pointer-events-none absolute inset-0 bg-slate-950/35" />

  <div className="relative z-10 space-y-2">
    {selectedPost && (
      <SelectedPostCard
        post={selectedPost}
        person={selectedPerson}
        currentUserId={currentUserId}
        onReact={addCustomEmojiReaction}
        onOpenReply={() => setIsReplyComposerOpen(true)}
        onOpenReplies={() => setIsRepliesOpen(true)}
      />
    )}

    <div
      className="relative -mt-1 h-[215px] touch-pan-y overflow-visible rounded-[2rem]"
      onPointerDown={(event) => {
  handleOrbitSwipeStart(event.clientX, event.clientY);
}}
      onPointerUp={(event) => {
        handleOrbitSwipeEnd(event.clientX);
      }}
      onPointerCancel={() => {
        setTouchStartX(null);
      }}
    >
      <div className="absolute left-1/2 top-[38%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/8 blur-3xl" />

      {posts.map((post, index) => {
        const position = getDepthPosition(index);
        const myBadges = getMyReactionBadges(post);
        const isActive = index === selectedPostIndex;

        return (
          <button
            key={post.id}
            type="button"
            onClick={() => choosePost(index)}
            className={`absolute left-1/2 top-[46%] grid h-22 w-22 place-items-center active:scale-95 ${
              isDraggingOrbit ? "transition-none" : "transition-all duration-500 ease-out"
            }`}
            style={{
              transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${position.scale})`,
              opacity: position.opacity,
              filter: `blur(${position.blur}px)`,
              zIndex: position.zIndex,
            }}
          >
            <div
  className={`relative grid h-full w-full place-items-center overflow-visible rounded-full border shadow-xl transition-all duration-500 ${
    isActive
      ? "border-white/50 shadow-white/20 ring-4 ring-white/10"
      : "border-white/10 shadow-black/30"
  }`}
>

<div
  className={`absolute inset-0 rounded-full bg-gradient-to-br ${post.gradient}`}
/>

              {post.photoUrl ? (
                <img
                  src={post.photoUrl}
                  alt={`${post.personName} post`}
                  className="absolute inset-0 h-full w-full rounded-full object-cover"
                />
              ) : (
                <div
                  className={`relative z-10 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br ${post.personColor} text-sm font-black text-slate-950`}
                >
                  {post.personInitials}
                </div>
              )}

              <div className="absolute inset-0 rounded-full bg-slate-950/10" />

             {myBadges.length > 0 && (
  <div className="absolute right-1 top-1 z-20 flex -translate-y-1/3 translate-x-1/3 -space-x-1">
    {myBadges.slice(0, 2).map((emoji, badgeIndex) => (
      <span
        key={`${post.id}-${emoji}-${badgeIndex}`}
        className="grid h-6 w-6 place-items-center rounded-full border border-slate-950/50 bg-white text-xs shadow-lg shadow-black/30"
      >
        {emoji}
      </span>
    ))}
  </div>
)}

              {isActive && (
                <div className="absolute -bottom-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-950 shadow-lg shadow-black/30">
                  {post.personName.split(" ")[0]}
                </div>
              )}
            </div>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => moveDial("prev")}
        className="absolute bottom-5 left-4 z-[120] grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-slate-950/45 text-xl text-white/75 shadow-xl backdrop-blur-xl active:scale-95"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={() => moveDial("next")}
        className="absolute bottom-5 right-4 z-[120] grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-slate-950/45 text-xl text-white/75 shadow-xl backdrop-blur-xl active:scale-95"
      >
        ›
      </button>

                        <div className="absolute bottom-2 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
        {selectedPostIndex + 1}/{posts.length}
      </div>
    </div>
  </div>
</div>

    {selectedPost && isReplyComposerOpen && (
      <ReplyComposerModal
        post={selectedPost}
        onClose={() => setIsReplyComposerOpen(false)}
        onSubmit={submitReply}
      />
    )}

    {selectedPost && isRepliesOpen && (
      <RepliesModal
        post={selectedPost}
        person={selectedPerson}
        onClose={() => setIsRepliesOpen(false)}
        onOpenReply={() => {
          setIsRepliesOpen(false);
          setIsReplyComposerOpen(true);
        }}
      />
    )}
  </div>
);
}

function LoopView({
  circle,
  onOpenCreateLoop,
  onArchiveLoop,
  onOpenCircleSettings,
  onSetParticipation,
  onVotePoll,
  onToggleTask,
  onOpenGuestPass,
}: {
  circle: Circle;
  onOpenCreateLoop: () => void;
  onOpenCircleSettings: () => void;
  onArchiveLoop: (loopId: string) => void;
  onSetParticipation: (loopId: string, personName: string, status: ParticipationStatus) => void;
  onVotePoll: (loopId: string, optionId: string, personName: string) => void;
  onToggleTask: (loopId: string, taskId: string) => void;
  onOpenGuestPass: (circleId: string, loopId: string) => void;
}) {
  const activeLoops = circle.loop.filter((item) => !item.archived);
  const archivedLoops = circle.loop.filter((item) => item.archived);
  const currentUserName = "Brandon";
  const [expandedLoopId, setExpandedLoopId] = useState<string | null>(
    activeLoops[0]?.id || null
  );

  function getLoopTypeStyle(type: LoopType) {
    if (type === "Trip") return "from-orange-200 to-rose-500";
    if (type === "Event") return "from-fuchsia-300 to-violet-600";
    if (type === "Decision") return "from-cyan-200 to-blue-600";
    if (type === "Check In") return "from-lime-200 to-emerald-600";
    return "from-white to-slate-300";
  }

  function getTimingLabel(timing: LoopTiming) {
    if (timing.type === "TBD") return "Timing TBD";

    if (timing.type === "All Day") {
      return timing.date ? `All day · ${timing.date}` : "All day";
    }

    if (timing.type === "Date Range") {
      if (timing.date && timing.endDate) return `${timing.date} to ${timing.endDate}`;
      if (timing.date) return `${timing.date} to TBD`;
      return "Date range TBD";
    }

    if (timing.date && timing.time) return `${timing.date} · ${timing.time}`;
    if (timing.date) return timing.date;

    return "Date and time TBD";
  }

  function getUserParticipation(item: LoopItem) {
    if (item.participants.in.includes(currentUserName)) return "In";
    if (item.participants.maybe.includes(currentUserName)) return "Maybe";
    if (item.participants.out.includes(currentUserName)) return "Out";
    return "Maybe";
  }

  function getTopPollOption(item: LoopItem) {
    if (!item.poll) return null;

    return [...item.poll.options].sort((a, b) => b.votes.length - a.votes.length)[0];
  }

  function getTaskProgress(item: LoopItem) {
    if (!item.tasks.length) return null;

    const done = item.tasks.filter((task) => task.done).length;
    return `${done}/${item.tasks.length} tasks`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[2.5rem] border border-white/10 bg-white/8 p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
        <p className="text-sm text-white/50">The Loop</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">
          Plans without the group chat chaos.
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/55">
          Create a lightweight hub for who is in, when it is happening, decisions, and tasks.
        </p>

        <button
          onClick={onOpenCreateLoop}
          className="mt-5 w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 shadow-xl shadow-black/20 active:scale-[0.98]"
        >
          Create a Loop
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
          Active Loops
        </h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
          {activeLoops.length}
        </span>
      </div>

      {activeLoops.length === 0 && (
        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 text-center backdrop-blur-2xl">
          <p className="text-lg font-semibold">No active Loops yet.</p>
          <p className="mt-2 text-sm leading-6 text-white/50">
            Create one for a plan, trip, decision, event, or check in.
          </p>
        </div>
      )}

      {activeLoops.map((item) => {
        const expanded = expandedLoopId === item.id;
        const userParticipation = getUserParticipation(item);
        const topPollOption = getTopPollOption(item);
        const taskProgress = getTaskProgress(item);

        return (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/10 shadow-xl shadow-black/20 backdrop-blur-2xl"
          >
            <button
              onClick={() => setExpandedLoopId(expanded ? null : item.id)}
              className="relative z-10 w-full p-5 text-left active:scale-[0.99]"
            >
              <div className={`absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br ${getLoopTypeStyle(item.type)} opacity-25 blur-2xl`} />
              <div className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full bg-gradient-to-r ${getLoopTypeStyle(item.type)} px-3 py-1 text-xs font-semibold text-slate-950`}>
                      {item.type}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                      {item.status}
                    </span>
                  </div>

                  <h3 className="mt-3 truncate text-2xl font-semibold">{item.title}</h3>

                  <p className="mt-2 text-sm text-cyan-100">
                    {getTimingLabel(item.timing)}
                  </p>

                  <p className="mt-1 truncate text-sm text-white/50">
                    {item.location ? `Location: ${item.location}` : "Location TBD"}
                  </p>
                </div>

                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg text-white/70">
                  {expanded ? "−" : "+"}
                </div>
              </div>

              <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                  {item.participants.in.length} in
                </span>

                {item.participants.maybe.length > 0 && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                    {item.participants.maybe.length} maybe
                  </span>
                )}

                {topPollOption && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                    Top vote: {topPollOption.label}
                  </span>
                )}

                {taskProgress && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                    {taskProgress}
                  </span>
                )}
              </div>
            </button>

            {expanded && (
              <div className="relative z-10 space-y-4 px-5 pb-5">
                {item.quickNote && (
                  <div className="rounded-[1.5rem] bg-white/8 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      Quick Note
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/70">{item.quickNote}</p>
                  </div>
                )}

                <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                        Your Status
                      </p>
                      <p className="mt-1 text-sm text-white/70">
                        You are marked as {userParticipation}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {(["In", "Maybe", "Out"] as ParticipationStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => onSetParticipation(item.id, currentUserName, status)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold active:scale-95 ${
                            userParticipation === status
                              ? "bg-white text-slate-950"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-[1.25rem] bg-white/8 p-3">
                      <p className="text-lg font-semibold">{item.participants.in.length}</p>
                      <p className="text-xs text-white/45">In</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-white/8 p-3">
                      <p className="text-lg font-semibold">{item.participants.maybe.length}</p>
                      <p className="text-xs text-white/45">Maybe</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-white/8 p-3">
                      <p className="text-lg font-semibold">{item.participants.out.length}</p>
                      <p className="text-xs text-white/45">Out</p>
                    </div>
                  </div>
                </div>

                {item.poll && (
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                          Decision
                        </p>
                        <h4 className="mt-1 text-base font-semibold">{item.poll.question}</h4>
                      </div>

                      {topPollOption && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
                          Top: {topPollOption.label}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      {item.poll.options.map((option) => {
                        const selected = option.votes.includes(currentUserName);
                        const totalVotes =
                          item.poll?.options.reduce(
                            (sum, pollOption) => sum + pollOption.votes.length,
                            0
                          ) || 0;
                        const percent = totalVotes
                          ? Math.round((option.votes.length / totalVotes) * 100)
                          : 0;

                        return (
                          <button
                            key={option.id}
                            onClick={() => onVotePoll(item.id, option.id, currentUserName)}
                            className={`w-full rounded-[1.25rem] border p-3 text-left active:scale-[0.99] ${
                              selected ? "border-white/30 bg-white/18" : "border-white/10 bg-white/8"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">{option.label}</span>
                              <span className="text-xs text-white/50">
                                {option.votes.length} votes · {percent}%
                              </span>
                            </div>

                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-white/70"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {item.tasks.length > 0 && (
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                        Tasks
                      </p>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
                        {item.tasks.filter((task) => task.done).length}/{item.tasks.length} done
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {item.tasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => onToggleTask(item.id, task.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-full bg-white/8 p-2 pl-4 text-left active:scale-[0.99]"
                        >
                          <div>
                            <p className={`text-sm ${task.done ? "text-white/35 line-through" : "text-white/80"}`}>
                              {task.title}
                            </p>
                            <p className="text-xs text-white/40">Owner: {task.owner}</p>
                          </div>

                          <span className={`grid h-8 w-8 place-items-center rounded-full text-xs ${
                            task.done ? "bg-white text-slate-950" : "bg-white/10 text-white/40"
                          }`}>
                            {task.done ? "✓" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
  <button
    onClick={() => onOpenGuestPass(circle.id, item.id)}
    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 active:scale-[0.98]"
  >
    Invite Guest
  </button>

  <button
    onClick={() => onArchiveLoop(item.id)}
    className="rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white/65 active:scale-[0.98]"
  >
    Archive
  </button>
</div>
              </div>
            )}
          </div>
        );
      })}

      {archivedLoops.length > 0 && (
        <>
          <div className="mt-6 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/35">
              Archived
            </h3>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/40">
              {archivedLoops.length}
            </span>
          </div>

          {archivedLoops.map((item) => (
            <div
              key={item.id}
              className="rounded-[2rem] border border-white/8 bg-white/5 p-4 opacity-60 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-white/40">{item.type}</p>
                  <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
                  Archived
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function CreateLoopModal({
  circle,
  onClose,
  onCreateLoop,
}: {
  circle: Circle;
  onClose: () => void;
  onCreateLoop: (loopItem: LoopItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [loopType, setLoopType] = useState<LoopType>("Plan");
  const [status, setStatus] = useState<LoopStatus>("Planning");
  const [timingType, setTimingType] = useState<TimingType>("TBD");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsText, setPollOptionsText] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    circle.members.map((person) => person.name)
  );

  const [enabledBlocks, setEnabledBlocks] = useState({
    note: false,
    poll: false,
    tasks: false,
  });

  const canCreate = title.trim().length > 1 && selectedPeople.length > 0;

  const loopTypes: LoopType[] = ["Plan", "Trip", "Event", "Decision", "Check In"];
  const statuses: LoopStatus[] = ["Idea", "Planning", "Scheduled", "Happening Soon", "Done", "Open", "Voting", "Decided"];
  const timingTypes: TimingType[] = ["TBD", "Date + Time", "All Day", "Date Range"];

  function togglePerson(name: string) {
    setSelectedPeople((currentPeople) => {
      if (currentPeople.includes(name)) {
        return currentPeople.filter((personName) => personName !== name);
      }

      return [...currentPeople, name];
    });
  }

  function toggleBlock(block: "note" | "poll" | "tasks") {
    setEnabledBlocks((currentBlocks) => ({
      ...currentBlocks,
      [block]: !currentBlocks[block],
    }));
  }

  function handleStartDateChange(value: string) {
    setDate(value);

    if (timingType === "Date Range" && value && (!endDate || endDate < value)) {
      setEndDate(value);
    }
  }

  function getLoopTypeHelp(type: LoopType) {
    if (type === "Trip") return "Best for getaways, itineraries, saved places, and bookings.";
    if (type === "Event") return "Best for birthdays, parties, concerts, and fixed plans.";
    if (type === "Decision") return "Best when the group needs to choose something.";
    if (type === "Check In") return "Best for soft plans, support, or recurring group touchpoints.";
    return "Best for dinners, drinks, workouts, and casual hangs.";
  }

  function buildPoll(): LoopPoll | undefined {
    if (!enabledBlocks.poll) return undefined;

    const options = pollOptionsText
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);

    if (!pollQuestion.trim() || options.length < 2) return undefined;

    return {
      question: pollQuestion.trim(),
      options: options.map((option, index) => ({
        id: `poll-option-${Date.now()}-${index}`,
        label: option,
        votes: [],
      })),
    };
  }

  function buildTasks(): LoopTask[] {
    if (!enabledBlocks.tasks) return [];

    return tasksText
      .split("\n")
      .map((task) => task.trim())
      .filter(Boolean)
      .map((task, index) => ({
        id: `task-${Date.now()}-${index}`,
        title: task,
        owner: selectedPeople[0] || "Brandon",
        done: false,
      }));
  }

  function handleCreate() {
    if (!canCreate) return;

    const newLoop: LoopItem = {
      id: `loop-${Date.now()}`,
      title: title.trim(),
      type: loopType,
      status,
      quickNote: enabledBlocks.note ? quickNote.trim() || undefined : undefined,
      timing: {
        type: timingType,
        date: date || undefined,
        time: time || undefined,
        endDate: endDate || undefined,
      },
      location: location.trim() || undefined,
      people: selectedPeople,
      participants: {
        in: ["Brandon"],
        maybe: selectedPeople.filter((name) => name !== "Brandon"),
        out: [],
      },
      poll: buildPoll(),
      tasks: buildTasks(),
      archived: false,
    };

    onCreateLoop(newLoop);
  }

  return (
    <div className="absolute inset-0 z-[230] bg-slate-950/70 px-5 py-8 backdrop-blur-2xl">
      <div className="flex h-full flex-col rounded-[3rem] border border-white/10 bg-slate-950/85 p-5 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">{circle.name}</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              Create a Loop.
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Start with the basics, then add only the blocks this plan needs.
            </p>
          </div>

          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-5 overflow-y-auto pr-1">
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 1</p>
            <h3 className="mt-1 text-lg font-semibold">Name the Loop</h3>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Friday drinks"
              className="mt-4 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 2</p>
            <h3 className="mt-1 text-lg font-semibold">Choose the Loop type</h3>
            <p className="mt-1 text-sm leading-5 text-white/45">
              {getLoopTypeHelp(loopType)}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {loopTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setLoopType(type)}
                  className={`rounded-full border px-4 py-3 text-sm active:scale-95 ${
                    loopType === type
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/8 text-white/65"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 3</p>
            <h3 className="mt-1 text-lg font-semibold">Timing</h3>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {timingTypes.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setTimingType(item);
                    if (item !== "Date Range") setEndDate("");
                  }}
                  className={`rounded-full border px-4 py-3 text-sm active:scale-95 ${
                    timingType === item
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/8 text-white/65"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {timingType !== "TBD" && (
              <div className="mt-4 grid gap-3">
                <input
                  type="date"
                  value={date}
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none focus:border-white/30"
                />

                {timingType === "Date + Time" && (
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none focus:border-white/30"
                  />
                )}

                {timingType === "Date Range" && (
                  <input
                    type="date"
                    value={endDate}
                    min={date || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none focus:border-white/30"
                  />
                )}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 4</p>
            <h3 className="mt-1 text-lg font-semibold">Location and status</h3>

            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="TBD, Jungle Bird, John’s apartment..."
              className="mt-4 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {statuses.map((item) => (
                <button
                  key={item}
                  onClick={() => setStatus(item)}
                  className={`shrink-0 rounded-full border px-4 py-3 text-sm active:scale-95 ${
                    status === item
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/8 text-white/65"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 5</p>
            <h3 className="mt-1 text-lg font-semibold">Add building blocks</h3>
            <p className="mt-1 text-sm leading-5 text-white/45">
              Choose only what this Loop needs. You can add more later.
            </p>

            <div className="mt-4 grid gap-2">
              <button
                onClick={() => toggleBlock("note")}
                className={`rounded-full border px-4 py-3 text-left text-sm active:scale-[0.99] ${
                  enabledBlocks.note
                    ? "border-white/30 bg-white text-slate-950"
                    : "border-white/10 bg-white/8 text-white/65"
                }`}
              >
                Quick Note
              </button>

              <button
                onClick={() => toggleBlock("poll")}
                className={`rounded-full border px-4 py-3 text-left text-sm active:scale-[0.99] ${
                  enabledBlocks.poll
                    ? "border-white/30 bg-white text-slate-950"
                    : "border-white/10 bg-white/8 text-white/65"
                }`}
              >
                Poll / Decision
              </button>

              <button
                onClick={() => toggleBlock("tasks")}
                className={`rounded-full border px-4 py-3 text-left text-sm active:scale-[0.99] ${
                  enabledBlocks.tasks
                    ? "border-white/30 bg-white text-slate-950"
                    : "border-white/10 bg-white/8 text-white/65"
                }`}
              >
                Task List
              </button>
            </div>
          </div>

          {enabledBlocks.note && (
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
              <h3 className="text-lg font-semibold">Quick Note</h3>
              <textarea
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                placeholder="Add context, vibe, or anything the group should know."
                className="mt-3 min-h-24 w-full resize-none rounded-[2rem] border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>
          )}

          {enabledBlocks.poll && (
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
              <h3 className="text-lg font-semibold">Poll / Decision</h3>
              <p className="mt-1 text-xs leading-5 text-white/40">
                Add a question and put each option on its own line.
              </p>

              <input
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                placeholder="Where should we go?"
                className="mt-3 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />

              <textarea
                value={pollOptionsText}
                onChange={(event) => setPollOptionsText(event.target.value)}
                placeholder={"Jungle Bird\nBar Bonobo\nShy Shy"}
                className="mt-3 min-h-24 w-full resize-none rounded-[2rem] border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>
          )}

          {enabledBlocks.tasks && (
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
              <h3 className="text-lg font-semibold">Task List</h3>
              <p className="mt-1 text-xs leading-5 text-white/40">
                Put each task on its own line.
              </p>

              <textarea
                value={tasksText}
                onChange={(event) => setTasksText(event.target.value)}
                placeholder={"Book reservation\nSend address\nBuy tickets"}
                className="mt-3 min-h-24 w-full resize-none rounded-[2rem] border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>
          )}

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 6</p>
                <h3 className="mt-1 text-lg font-semibold">People in this Loop</h3>
              </div>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                {selectedPeople.length}
              </span>
            </div>

            <div className="mt-4 grid gap-2">
              {circle.members.map((person) => {
                const selected = selectedPeople.includes(person.name);

                return (
                  <button
                    key={person.id}
                    onClick={() => togglePerson(person.name)}
                    className={`flex items-center justify-between rounded-full border p-2 pr-4 text-left active:scale-[0.99] ${
                      selected ? "border-white/25 bg-white/14" : "border-white/10 bg-white/7"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar person={person} size="sm" />
                      <span className="text-sm font-medium">{person.name}</span>
                    </div>

                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
                      selected ? "bg-white text-slate-950" : "bg-white/10 text-white/40"
                    }`}>
                      {selected ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className={`mt-5 w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
            canCreate ? "bg-white text-slate-950" : "bg-white/10 text-white/30"
          }`}
        >
          Create Loop
        </button>
      </div>
    </div>
  );
}

function PeopleView({
  contacts,
  incomingRequests,
  onOpenAddPerson,
  onUpdatePersonStatus,
  onRemoveFriend,
  onAcceptFriendRequest,
  onIgnoreFriendRequest,
}: {
  contacts: Person[];
  incomingRequests: FriendRequest[];
  onOpenAddPerson: () => void;
  onUpdatePersonStatus: (personId: string, status: ContactStatus) => void;
  onAcceptFriendRequest: (request: FriendRequest) => void;
  onIgnoreFriendRequest: (request: FriendRequest) => void;
  onRemoveFriend: (personId: string) => void;
}) {
  const friends = contacts.filter((person) => person.status === "Friend");
  const sentRequests = contacts.filter((person) => person.status === "Pending");

  function renderPersonRow(person: Person) {
    return (
      <div
        key={person.id}
        className="rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-xl shadow-black/10 backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar person={person} size="md" />

            <div className="min-w-0">
  <p className="truncate text-base font-semibold">{person.name}</p>
  <p className="truncate text-xs text-white/45">
    {person.email || person.status}
  </p>
</div>
          </div>

          {person.status === "Pending" && (
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/45">
              Sent
            </span>
          )}

          {person.status === "Friend" && (
  <div className="flex shrink-0 items-center gap-2">
    <span className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/45">
      Friend
    </span>

    <button
      onClick={() => onRemoveFriend(person.id)}
      className="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold text-white/45 active:scale-95"
    >
      Remove
    </button>
  </div>
)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[2.5rem] border border-white/10 bg-white/8 p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
        <p className="text-sm text-white/50">People</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">
          Your private social layer.
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/55">
          Your People are friends who have accepted your request. Pending requests cannot be added to Circles yet.
        </p>

        <button
          onClick={onOpenAddPerson}
          className="mt-5 w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 shadow-xl shadow-black/20 active:scale-[0.98]"
        >
          Send Request
        </button>
      </div>

      {incomingRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
              Requests
            </h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">
              {incomingRequests.length}
            </span>
          </div>

          {incomingRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-[2rem] border border-cyan-200/20 bg-cyan-300/10 p-4 shadow-xl shadow-black/10 backdrop-blur-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-sm font-black text-slate-950">
                  {request.fromName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {request.fromName}
                  </p>
                  <p className="truncate text-xs text-white/45">
                    {request.fromEmail}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-white/60">
                Wants to add you to their People.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onIgnoreFriendRequest(request)}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white/60 active:scale-95"
                >
                  Ignore
                </button>

                <button
                  onClick={() => onAcceptFriendRequest(request)}
                  className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 active:scale-95"
                >
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-[1.5rem] bg-white/8 p-3">
          <p className="text-xl font-semibold">{friends.length}</p>
          <p className="text-[10px] text-white/45">Friends</p>
        </div>

        <div className="rounded-[1.5rem] bg-white/8 p-3">
          <p className="text-xl font-semibold">{sentRequests.length}</p>
          <p className="text-[10px] text-white/45">Sent</p>
        </div>
      </div>

      {friends.length > 0 && (
        <div className="space-y-3">
          <h3 className="px-1 text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
            Your People
          </h3>
          {friends.map(renderPersonRow)}
        </div>
      )}

      {sentRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="px-1 text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
            Sent Requests
          </h3>
          {sentRequests.map(renderPersonRow)}
        </div>
      )}

      {friends.length === 0 && sentRequests.length === 0 && incomingRequests.length === 0 && (
        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 text-center backdrop-blur-2xl">
          <p className="text-lg font-semibold">No People yet.</p>
          <p className="mt-2 text-sm leading-6 text-white/50">
            Add someone by email to send your first request.
          </p>
        </div>
      )}
    </div>
  );
}

function AddPersonModal({
  onClose,
  onAddPerson,
}: {
  onClose: () => void;
  onAddPerson: (name: string, email: string, status: ContactStatus) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const canAdd = email.trim().includes("@");

  return (
    <div className="fixed inset-0 z-[260] overflow-hidden bg-slate-950/80 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-h-full w-full max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black">
        <div className="shrink-0 border-b border-white/10 bg-slate-950/80 p-4 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">People</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Send a request.
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Invite someone to become one of Your People. Once they accept, you can add each other to Circles.
              </p>
            </div>

            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <label className="text-sm text-white/60">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@email.com"
              className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />

            <div className="mt-4">
              <label className="text-sm text-white/60">
                Name <span className="text-white/30">(optional)</span>
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="John"
                className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>

            <p className="mt-4 text-xs leading-5 text-white/40">
              For this beta, they will see the request when they sign up or sign in with this email.
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-slate-950/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-2xl">
          <button
            onClick={() => onAddPerson(name, email, "Pending")}
            disabled={!canAdd}
            className={`w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
              canAdd ? "bg-white text-slate-950" : "bg-white/10 text-white/30"
            }`}
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateGuestPassModal({
  circles,
  contacts,
  initialCircleId,
  initialLoopId,
  onClose,
  onCreateGuestPass,
}: {
  circles: Circle[];
  contacts: Person[];
  initialCircleId: string;
  initialLoopId?: string;
  onClose: () => void;
  onCreateGuestPass: (guestPass: Omit<GuestPass, "id" | "status">) => void;
}) {
  const initialCircle = circles.find((circle) => circle.id === initialCircleId) || circles[0];
  const initialLoops = initialCircle.loop.filter((loopItem) => !loopItem.archived);

  const [guestName, setGuestName] = useState(contacts[0]?.name || "");
  const [circleId, setCircleId] = useState(initialCircle.id);
  const [loopId, setLoopId] = useState(initialLoopId || initialLoops[0]?.id || "");
  const [duration, setDuration] = useState<GuestPassDuration>("24 hours");
  const [access, setAccess] = useState<GuestAccess>("Loop only");
  const [introPrompt, setIntroPrompt] = useState("Introduce yourself with one photo and your plan energy.");
  const [note, setNote] = useState("");

  const selectedCircle = circles.find((circle) => circle.id === circleId) || circles[0];
  const activeLoops = selectedCircle.loop.filter((loopItem) => !loopItem.archived);
  const selectedLoop = activeLoops.find((loopItem) => loopItem.id === loopId) || activeLoops[0];

  const canCreate = guestName.trim().length > 1 && Boolean(selectedLoop);

  const durations: GuestPassDuration[] = ["Tonight", "24 hours", "3 days", "1 week"];
  const accessOptions: GuestAccess[] = [
    "Loop only",
    "Loop + today’s Orbit",
    "Loop + member intros",
  ];

  function handleCircleChange(nextCircleId: string) {
    const nextCircle = circles.find((circle) => circle.id === nextCircleId);
    const nextActiveLoops = nextCircle?.loop.filter((loopItem) => !loopItem.archived) || [];

    setCircleId(nextCircleId);
    setLoopId(nextActiveLoops[0]?.id || "");
  }

  function handleCreate() {
    if (!canCreate || !selectedLoop) return;

    onCreateGuestPass({
      guestName: guestName.trim(),
      circleId: selectedCircle.id,
      loopId: selectedLoop.id,
      duration,
      access,
      introPrompt: introPrompt.trim() || "Introduce yourself to the group.",
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="absolute inset-0 z-[240] bg-slate-950/70 px-5 py-8 backdrop-blur-2xl">
      <div className="flex h-full flex-col rounded-[3rem] border border-white/10 bg-slate-950/85 p-5 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">Guest Pass</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              Invite someone in temporarily.
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Guest Passes are tied to a Loop, not the whole Circle.
            </p>
          </div>

          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-5 overflow-y-auto pr-1">
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
  <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 1</p>
  <h3 className="mt-1 text-lg font-semibold">Choose a friend</h3>
  <p className="mt-1 text-sm leading-5 text-white/45">
    Choose someone from Your People to temporarily add to this Loop. They will not join the whole Circle.
  </p>

  {contacts.length > 0 ? (
    <div className="mt-4 grid gap-2">
      {contacts.map((person) => (
        <button
          key={person.id}
          onClick={() => setGuestName(person.name)}
          className={`flex items-center justify-between rounded-full border p-2 pr-4 text-left active:scale-[0.99] ${
            guestName === person.name
              ? "border-white/30 bg-white text-slate-950"
              : "border-white/10 bg-white/8 text-white/65"
          }`}
        >
          <div className="flex items-center gap-3">
            <Avatar person={person} size="sm" />
            <span className="text-sm font-medium">{person.name}</span>
          </div>

          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
            guestName === person.name ? "bg-slate-950 text-white" : "bg-white/10 text-white/40"
          }`}>
            {guestName === person.name ? "✓" : "+"}
          </span>
        </button>
      ))}
    </div>
  ) : (
    <div className="mt-4 rounded-[1.5rem] bg-white/8 p-4 text-sm leading-6 text-white/50">
      You do not have any active friends to invite yet. Add someone in People first.
    </div>
  )}
</div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 2</p>
            <h3 className="mt-1 text-lg font-semibold">Choose the doorway</h3>
            <p className="mt-1 text-sm leading-5 text-white/45">
              Guests enter through one active Loop so access stays contextual.
            </p>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {circles.map((circle) => (
                <button
                  key={circle.id}
                  onClick={() => handleCircleChange(circle.id)}
                  className={`shrink-0 rounded-full border px-4 py-3 text-sm active:scale-95 ${
                    circleId === circle.id
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/8 text-white/65"
                  }`}
                >
                  {circle.name}
                </button>
              ))}
            </div>

            {activeLoops.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {activeLoops.map((loopItem) => (
                  <button
                    key={loopItem.id}
                    onClick={() => setLoopId(loopItem.id)}
                    className={`rounded-[1.5rem] border p-4 text-left active:scale-[0.99] ${
                      loopId === loopItem.id
                        ? "border-white/30 bg-white text-slate-950"
                        : "border-white/10 bg-white/8 text-white/65"
                    }`}
                  >
                    <p className="font-semibold">{loopItem.title}</p>
                    <p className={`mt-1 text-xs ${loopId === loopItem.id ? "text-slate-600" : "text-white/40"}`}>
                      {loopItem.type} · {loopItem.participants.in.length} in
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-[1.5rem] bg-white/8 p-4 text-sm text-white/50">
                This Circle has no active Loops yet. Create a Loop first, then invite a guest.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 3</p>
            <h3 className="mt-1 text-lg font-semibold">Set access</h3>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {durations.map((item) => (
                <button
                  key={item}
                  onClick={() => setDuration(item)}
                  className={`rounded-full border px-4 py-3 text-sm active:scale-95 ${
                    duration === item
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/8 text-white/65"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2">
              {accessOptions.map((item) => (
                <button
                  key={item}
                  onClick={() => setAccess(item)}
                  className={`rounded-full border px-4 py-3 text-left text-sm active:scale-[0.99] ${
                    access === item
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/8 text-white/65"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Step 4</p>
            <h3 className="mt-1 text-lg font-semibold">Intro prompt</h3>

            <textarea
              value={introPrompt}
              onChange={(event) => setIntroPrompt(event.target.value)}
              className="mt-4 min-h-24 w-full resize-none rounded-[2rem] border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note for the guest..."
              className="mt-3 min-h-20 w-full resize-none rounded-[2rem] border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className={`mt-5 w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
            canCreate ? "bg-white text-slate-950" : "bg-white/10 text-white/30"
          }`}
        >
          Create Guest Pass
        </button>
      </div>
    </div>
  );
}

function GuestPassPreviewModal({
  guestPass,
  circles,
  onClose,
}: {
  guestPass: GuestPass;
  circles: Circle[];
  onClose: () => void;
}) {
  const circle = circles.find((item) => item.id === guestPass.circleId);
  const loop = circle?.loop.find((item) => item.id === guestPass.loopId);

  return (
    <div className="absolute inset-0 z-[250] bg-slate-950/75 px-5 py-8 backdrop-blur-2xl">
      <div className="flex h-full flex-col rounded-[3rem] border border-white/10 bg-slate-950/85 p-5 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">Preview</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              Guest Pass created.
            </h2>
          </div>

          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
          >
            ×
          </button>
        </div>

        <div className="mt-8 rounded-[3rem] border border-dashed border-white/25 bg-white/10 p-5 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-white/50 bg-white/10 text-2xl font-black">
              GP
            </div>

            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
              {guestPass.duration}
            </span>
          </div>

          <p className="mt-6 text-sm uppercase tracking-[0.22em] text-white/35">
            Invite
          </p>

          <h3 className="mt-2 text-2xl font-semibold">
            {guestPass.guestName} is invited to {loop?.title || "this Loop"}.
          </h3>

          <p className="mt-3 text-sm leading-6 text-white/60">
            Access: {guestPass.access}
          </p>

          <p className="mt-1 text-sm leading-6 text-white/60">
            Circle: {circle?.name || "Unknown Circle"}
          </p>

          <div className="mt-5 rounded-[2rem] bg-white/8 p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
              Intro Prompt
            </p>
            <p className="mt-2 text-sm leading-6 text-white/75">
              {guestPass.introPrompt}
            </p>
          </div>

          {guestPass.note && (
            <div className="mt-3 rounded-[2rem] bg-white/8 p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                Note
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {guestPass.note}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <button className="w-full rounded-full bg-white px-5 py-4 font-semibold text-slate-950 active:scale-[0.98]">
            Copy Invite Link
          </button>

          <button
            onClick={onClose}
            className="w-full rounded-full bg-white/10 px-5 py-4 font-semibold text-white/65 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function MapView({
  circles,
  selectedCircleId,
  setSelectedCircleId,
}: {
  circles: Circle[];
  selectedCircleId: string;
  setSelectedCircleId: (circleId: string) => void;
}) {
  const selectedCircle = circles.find((circle) => circle.id === selectedCircleId) || null;

if (!selectedCircle) {
  return (
    <div className="rounded-[2.5rem] border border-white/10 bg-white/8 p-6 text-center shadow-xl shadow-black/20 backdrop-blur-2xl">
      <h2 className="text-2xl font-semibold">No map yet.</h2>
      <p className="mt-3 text-sm leading-6 text-white/55">
        Create a Circle first to see your social map.
      </p>
    </div>
  );
}

  const [mapMode, setMapMode] = useState<"Plans" | "People" | "Circles">("Plans");
  const [selectedMapItem, setSelectedMapItem] = useState<{
    type: "loop" | "person" | "circle";
    id: string;
  }>({
    type: "loop",
    id: circles.flatMap((circle) => circle.loop).find((loopItem) => !loopItem.archived)?.id || selectedCircle.id,
  });

  const connectionData = useMemo(() => {
    const personMap = new Map<
      string,
      {
        person: Person;
        circles: Circle[];
        activeLoops: LoopItem[];
        guestCircleCount: number;
      }
    >();

    circles.forEach((circle) => {
      const activeCircleLoops = circle.loop.filter((loopItem) => !loopItem.archived);

      circle.members.forEach((person) => {
        if (person.id === "brandon") return;

        const relevantLoops = activeCircleLoops.filter(
          (loopItem) => loopItem.people.includes(person.name) || loopItem.people.includes("Everyone")
        );

        const existing = personMap.get(person.id);

        if (existing) {
          existing.circles.push(circle);
          existing.activeLoops.push(...relevantLoops);
          existing.guestCircleCount += circle.guest ? 1 : 0;
        } else {
          personMap.set(person.id, {
            person,
            circles: [circle],
            activeLoops: relevantLoops,
            guestCircleCount: circle.guest ? 1 : 0,
          });
        }
      });
    });

    return Array.from(personMap.values()).sort((a, b) => {
      if (b.circles.length !== a.circles.length) return b.circles.length - a.circles.length;
      return b.activeLoops.length - a.activeLoops.length;
    });
  }, [circles]);

  const activeLoopMarkers = useMemo(() => {
    return circles.flatMap((circle) =>
      circle.loop
        .filter((loopItem) => !loopItem.archived)
        .map((loopItem) => ({
          loop: loopItem,
          circle,
        }))
    );
  }, [circles]);

  const attentionItems = activeLoopMarkers
    .map((marker) => {
      const loop = marker.loop;

      if (!loop.location || loop.location === "TBD") {
        return {
          id: `${loop.id}-location`,
          title: loop.title,
          issue: "Location not set",
        };
      }

      if (loop.poll) {
        return {
          id: `${loop.id}-poll`,
          title: loop.title,
          issue: "Decision open",
        };
      }

      const openTasks = loop.tasks.filter((task) => !task.done);

      if (openTasks.length > 0) {
        return {
          id: `${loop.id}-tasks`,
          title: loop.title,
          issue: `${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}`,
        };
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 3) as { id: string; title: string; issue: string }[];

  const selectedPersonConnection =
    selectedMapItem.type === "person"
      ? connectionData.find((connection) => connection.person.id === selectedMapItem.id)
      : undefined;

  const selectedLoopMarker =
    selectedMapItem.type === "loop"
      ? activeLoopMarkers.find((marker) => marker.loop.id === selectedMapItem.id)
      : undefined;

  const selectedCircleForDetail =
    selectedMapItem.type === "circle"
      ? circles.find((circle) => circle.id === selectedMapItem.id) || selectedCircle
      : selectedCircle;

  function getConnectionLabel(sharedCircleCount: number, guestCircleCount: number) {
    if (guestCircleCount > 0 && sharedCircleCount === 1) return "Guest Connection";
    if (sharedCircleCount >= 3) return "Bridge Person";
    if (sharedCircleCount === 2) return "Frequent Overlap";
    return "Single Circle";
  }

  function getLoopTypeStyle(type: LoopType) {
    if (type === "Trip") return "from-orange-200 to-rose-500";
    if (type === "Event") return "from-fuchsia-300 to-violet-600";
    if (type === "Decision") return "from-cyan-200 to-blue-600";
    if (type === "Check In") return "from-lime-200 to-emerald-600";
    return "from-cyan-200 to-blue-500";
  }

  function getTimingLabel(timing: LoopTiming) {
    if (timing.type === "TBD") return "Timing TBD";

    if (timing.type === "All Day") {
      return timing.date ? `All day · ${timing.date}` : "All day";
    }

    if (timing.type === "Date Range") {
      if (timing.date && timing.endDate) return `${timing.date} to ${timing.endDate}`;
      if (timing.date) return `${timing.date} to TBD`;
      return "Date range TBD";
    }

    if (timing.date && timing.time) return `${timing.date} · ${timing.time}`;
    if (timing.date) return timing.date;

    return "Date and time TBD";
  }

  function getLoopSummary(loopItem: LoopItem) {
    const inCount = loopItem.participants.in.length;
    const taskCount = loopItem.tasks.filter((task) => !task.done).length;
    const hasPoll = Boolean(loopItem.poll);

    if (hasPoll) return `${inCount} in · decision open`;
    if (taskCount > 0) return `${inCount} in · ${taskCount} open ${taskCount === 1 ? "task" : "tasks"}`;
    return `${inCount} in · ${loopItem.status}`;
  }

  function getModeSummary() {
    if (mapMode === "Plans") {
      return `${activeLoopMarkers.length} active ${activeLoopMarkers.length === 1 ? "Loop" : "Loops"} need coordination`;
    }

    if (mapMode === "People") {
      const strongest = connectionData[0];
      return strongest
        ? `${strongest.person.name} connects ${strongest.circles.length} of your Circles`
        : "No people connections yet";
    }

    return `${circles.length} private Circles in your orbit`;
  }

  function switchMode(mode: "Plans" | "People" | "Circles") {
    setMapMode(mode);

    if (mode === "Plans" && activeLoopMarkers[0]) {
      setSelectedMapItem({ type: "loop", id: activeLoopMarkers[0].loop.id });
      setSelectedCircleId(activeLoopMarkers[0].circle.id);
    }

    if (mode === "People" && connectionData[0]) {
      setSelectedMapItem({ type: "person", id: connectionData[0].person.id });
    }

    if (mode === "Circles") {
      setSelectedMapItem({ type: "circle", id: selectedCircleId });
    }
  }

  const planPins = [
    ["14%", "28%"],
    ["54%", "22%"],
    ["31%", "54%"],
    ["64%", "62%"],
    ["19%", "72%"],
  ];

  const peoplePins = [
    ["15%", "30%"],
    ["62%", "27%"],
    ["38%", "46%"],
    ["68%", "60%"],
    ["18%", "68%"],
    ["51%", "74%"],
  ];

  const circleZones = [
    "left-[5%] top-[16%] h-64 w-64",
    "left-[38%] top-[18%] h-60 w-60",
    "left-[14%] top-[48%] h-56 w-56",
    "left-[52%] top-[54%] h-48 w-48",
    "left-[50%] top-[6%] h-36 w-36",
  ];

  const neighborhoodLabels = [
    { name: "Chelsea", left: "10%", top: "13%" },
    { name: "West Village", left: "53%", top: "14%" },
    { name: "Hoboken", left: "13%", top: "81%" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-[2.5rem] border border-white/10 bg-white/8 p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
        <h2 className="text-3xl font-semibold tracking-tight">
          What is active in your orbit.
        </h2>

        <p className="mt-3 text-sm leading-6 text-white/55">
          See plans that need attention, people who connect your Circles, and the groups currently active around you.
        </p>

        <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/8 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
            Today’s Signal
          </p>

          <p className="mt-2 text-lg font-semibold leading-6">{getModeSummary()}</p>

          {attentionItems.length > 0 && mapMode === "Plans" && (
            <div className="mt-4 space-y-2">
              {attentionItems.map((item) => (
                <div key={item.id} className="rounded-full bg-white/8 px-4 py-2">
                  <p className="truncate text-xs text-white/60">
                    <span className="font-semibold text-white/85">{item.title}</span>
                    {" · "}
                    {item.issue}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["Plans", "People", "Circles"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => switchMode(mode)}
            className={`rounded-full border px-4 py-3 text-sm active:scale-95 ${
              mapMode === mode
                ? "border-white/30 bg-white text-slate-950"
                : "border-white/10 bg-white/8 text-white/65"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {mapMode === "Plans" &&
          activeLoopMarkers.map((marker) => (
            <button
              key={marker.loop.id}
              onClick={() => {
                setSelectedMapItem({ type: "loop", id: marker.loop.id });
                setSelectedCircleId(marker.circle.id);
              }}
              className={`shrink-0 rounded-full border px-4 py-3 text-sm active:scale-95 ${
                selectedMapItem.type === "loop" && selectedMapItem.id === marker.loop.id
                  ? "border-white/30 bg-white text-slate-950"
                  : "border-white/10 bg-white/8 text-white/65"
              }`}
            >
              {marker.loop.title}
            </button>
          ))}

        {mapMode === "People" &&
          connectionData.map((connection) => (
            <button
              key={connection.person.id}
              onClick={() => setSelectedMapItem({ type: "person", id: connection.person.id })}
              className={`shrink-0 rounded-full border px-4 py-3 text-sm active:scale-95 ${
                selectedMapItem.type === "person" && selectedMapItem.id === connection.person.id
                  ? "border-white/30 bg-white text-slate-950"
                  : "border-white/10 bg-white/8 text-white/65"
              }`}
            >
              {connection.person.name}
            </button>
          ))}

        {mapMode === "Circles" &&
          circles.map((circle) => (
            <button
              key={circle.id}
              onClick={() => {
                setSelectedCircleId(circle.id);
                setSelectedMapItem({ type: "circle", id: circle.id });
              }}
              className={`shrink-0 rounded-full border px-4 py-3 text-sm active:scale-95 ${
                selectedMapItem.type === "circle" && selectedMapItem.id === circle.id
                  ? "border-white/30 bg-white text-slate-950"
                  : "border-white/10 bg-white/8 text-white/65"
              }`}
            >
              {circle.name}
            </button>
          ))}
      </div>

      <div className="relative h-[500px] overflow-hidden rounded-[3rem] border border-white/10 bg-slate-950/75 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_72%_28%,rgba(217,70,239,0.14),transparent_24%),radial-gradient(circle_at_38%_80%,rgba(249,115,22,0.12),transparent_30%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(2,6,23,0.72))]" />

        <div className="absolute left-[-20%] top-[35%] h-64 w-[140%] rotate-[-24deg] rounded-full border border-white/7" />
        <div className="absolute left-[-20%] top-[55%] h-56 w-[140%] rotate-[18deg] rounded-full border border-white/7" />
        <div className="absolute left-[22%] top-[-20%] h-[130%] w-40 rotate-[12deg] rounded-full border border-white/7" />
        <div className="absolute left-[62%] top-[-16%] h-[120%] w-36 rotate-[-10deg] rounded-full border border-white/7" />

        {neighborhoodLabels.map((label) => (
          <span
            key={label.name}
            className="absolute rounded-full bg-white/8 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/35"
            style={{ left: label.left, top: label.top }}
          >
            {label.name}
          </span>
        ))}

        {circles.slice(0, 5).map((circle, index) => {
          const active = circle.id === selectedCircleId;

          return (
            <button
              key={circle.id}
              onClick={() => {
                setSelectedCircleId(circle.id);
                setSelectedMapItem({ type: "circle", id: circle.id });
                setMapMode("Circles");
              }}
              className={`absolute rounded-full border transition-all duration-300 ${
                circleZones[index] || "left-[30%] top-[30%] h-44 w-44"
              } ${
                mapMode === "Circles" && active
                  ? "border-white/35 bg-white/12 opacity-100 shadow-2xl shadow-cyan-950/40"
                  : "border-white/8 bg-white/5 opacity-15"
              } ${circle.guest ? "border-dashed" : ""}`}
            >
              <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${circle.color} opacity-20 blur-sm`} />
            </button>
          );
        })}

        <div className="absolute left-[42%] top-[43%] z-40 grid h-20 w-20 place-items-center rounded-full bg-white text-sm font-black text-slate-950 shadow-2xl shadow-black/40 ring-4 ring-white/30">
          You
        </div>

        {mapMode === "Plans" &&
          activeLoopMarkers.slice(0, 5).map((marker, index) => {
            const loopItem = marker.loop;
            const position = planPins[index % planPins.length];
            const selected = selectedMapItem.type === "loop" && selectedMapItem.id === loopItem.id;

            return (
              <button
                key={loopItem.id}
                onClick={() => {
                  setSelectedMapItem({ type: "loop", id: loopItem.id });
                  setSelectedCircleId(marker.circle.id);
                }}
                className="absolute z-50 min-w-[132px] active:scale-95"
                style={{ left: position[0], top: position[1] }}
              >
                <div
                  className={`rounded-[1.5rem] border bg-slate-950/80 p-3 text-left shadow-2xl shadow-black/40 backdrop-blur-xl ${
                    selected ? "border-white/60 ring-4 ring-white/20" : "border-white/15"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${getLoopTypeStyle(loopItem.type)} text-[10px] font-black text-slate-950`}>
                      {loopItem.type.slice(0, 1)}
                    </span>

                   <div className="min-w-0">
  <p className="max-w-[78px] truncate text-sm font-semibold text-white">
    {loopItem.title}
  </p>
  <p className="text-[10px] text-white/45">
    {marker.circle.name}
  </p>
</div>
                  </div>

                  <p className="mt-2 text-[11px] text-white/55">{getLoopSummary(loopItem)}</p>
                </div>
              </button>
            );
          })}

        {mapMode === "People" &&
          connectionData.slice(0, 6).map((connection, index) => {
            const position = peoplePins[index % peoplePins.length];
            const person = connection.person;
            const isGuestOnly = connection.guestCircleCount > 0 && connection.circles.length === 1;
            const selected = selectedMapItem.type === "person" && selectedMapItem.id === person.id;

            return (
              <button
                key={person.id}
                onClick={() => setSelectedMapItem({ type: "person", id: person.id })}
                className="absolute z-50 active:scale-95"
                style={{ left: position[0], top: position[1] }}
              >
                <div
                  className={`relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${person.color} font-bold text-slate-950 shadow-xl shadow-black/40 ${
                    selected ? "scale-110 ring-4 ring-white/75" : "ring-2 ring-white/35"
                  } ${isGuestOnly ? "border-2 border-dashed border-white/70" : ""}`}
                >
                  {person.initials}

                  <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-white text-[10px] font-black text-slate-950 shadow-lg">
                    {connection.circles.length}
                  </span>

                  {connection.activeLoops.length > 0 && (
                    <span className="absolute -bottom-2 rounded-full bg-slate-950 px-2 py-0.5 text-[9px] font-semibold text-white ring-1 ring-white/20">
                      {connection.activeLoops.length} Loop
                    </span>
                  )}
                </div>
              </button>
            );
          })}

        {mapMode === "Circles" &&
          selectedCircleForDetail.members
            .filter((person) => person.id !== "brandon")
            .slice(0, 7)
            .map((person, index) => {
              const position = peoplePins[index % peoplePins.length];

              return (
                <button
                  key={person.id}
                  onClick={() => setSelectedMapItem({ type: "person", id: person.id })}
                  className="absolute z-50 active:scale-95"
                  style={{ left: position[0], top: position[1] }}
                >
                  <Avatar person={person} size="lg" />
                </button>
              );
            })}
      </div>

      {mapMode === "Plans" && (
        <div className="rounded-[2.5rem] border border-white/10 bg-white/10 p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
          {selectedLoopMarker ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/45">{selectedLoopMarker.circle.name}</p>
                  <h3 className="mt-1 text-2xl font-semibold">{selectedLoopMarker.loop.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {getTimingLabel(selectedLoopMarker.loop.timing)}
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    Location: {selectedLoopMarker.loop.location || "TBD"}
                  </p>
                </div>

                <span className={`rounded-full bg-gradient-to-r ${getLoopTypeStyle(selectedLoopMarker.loop.type)} px-3 py-1 text-xs font-semibold text-slate-950`}>
                  {selectedLoopMarker.loop.type}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[1.25rem] bg-white/8 p-3">
                  <p className="text-lg font-semibold">{selectedLoopMarker.loop.participants.in.length}</p>
                  <p className="text-xs text-white/45">In</p>
                </div>

                <div className="rounded-[1.25rem] bg-white/8 p-3">
                  <p className="text-lg font-semibold">{selectedLoopMarker.loop.participants.maybe.length}</p>
                  <p className="text-xs text-white/45">Maybe</p>
                </div>

                <div className="rounded-[1.25rem] bg-white/8 p-3">
                  <p className="text-lg font-semibold">
                    {selectedLoopMarker.loop.poll ? 1 : 0}
                  </p>
                  <p className="text-xs text-white/45">Decisions</p>
                </div>
              </div>

              <button className="mt-5 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 active:scale-[0.98]">
                Open from Loop tab
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">Active around you</p>
              <p className="mt-2 text-sm text-white/50">
                Select a Loop to see timing, location, who is in, and what needs attention.
              </p>
            </>
          )}
        </div>
      )}

      {mapMode === "People" && selectedPersonConnection && (
        <div className="rounded-[2.5rem] border border-white/10 bg-white/10 p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
          <div className="flex items-start gap-4">
            <Avatar person={selectedPersonConnection.person} size="lg" />

            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/45">
                {getConnectionLabel(
                  selectedPersonConnection.circles.length,
                  selectedPersonConnection.guestCircleCount
                )}
              </p>

              <h3 className="mt-1 text-2xl font-semibold">
                {selectedPersonConnection.person.name}
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                This person connects {selectedPersonConnection.circles.length} of your Circles and appears in{" "}
                {selectedPersonConnection.activeLoops.length} active{" "}
                {selectedPersonConnection.activeLoops.length === 1 ? "Loop" : "Loops"}.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {selectedPersonConnection.circles.map((circle) => (
              <button
                key={circle.id}
                onClick={() => {
                  setSelectedCircleId(circle.id);
                  setSelectedMapItem({ type: "circle", id: circle.id });
                  setMapMode("Circles");
                }}
                className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/8 p-2 pl-4 text-left text-white/65 active:scale-[0.99]"
              >
                <div>
                  <p className="text-sm font-semibold">{circle.name}</p>
                  <p className="text-xs text-white/40">
                    {circle.guest ? "Guest Orbit" : `${circle.members.length}/8 people`}
                  </p>
                </div>

                <span className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${circle.color}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {mapMode === "Circles" && (
        <div className="rounded-[2.5rem] border border-white/10 bg-white/10 p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">Selected Circle</p>
              <h3 className="mt-1 text-2xl font-semibold">{selectedCircleForDetail.name}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">
                {selectedCircleForDetail.members.length}/8 people · {selectedCircleForDetail.pulse}
              </p>
            </div>

            <span className={`grid h-12 w-12 rounded-full bg-gradient-to-br ${selectedCircleForDetail.color}`} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[1.5rem] bg-white/8 p-4">
              <p className="text-2xl font-semibold">{selectedCircleForDetail.posts.length}</p>
              <p className="text-xs text-white/45">Orbit posts</p>
            </div>

            <div className="rounded-[1.5rem] bg-white/8 p-4">
              <p className="text-2xl font-semibold">
                {selectedCircleForDetail.loop.filter((loopItem) => !loopItem.archived).length}
              </p>
              <p className="text-xs text-white/45">Active Loops</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {selectedCircleForDetail.members.map((person) => (
              <span key={person.id} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                {person.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[2.5rem] border border-white/10 bg-white/8 p-5 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
            Bridge People
          </h3>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
            Top {Math.min(3, connectionData.length)}
          </span>
        </div>

        <p className="mt-2 text-sm leading-6 text-white/50">
          Bridge People are friends who show up across multiple Circles. They connect different parts of your social life.
        </p>

        <div className="mt-4 space-y-3">
          {connectionData.slice(0, 3).map((connection) => (
            <button
              key={connection.person.id}
              onClick={() => {
                setMapMode("People");
                setSelectedMapItem({ type: "person", id: connection.person.id });
              }}
              className="flex w-full items-center justify-between rounded-full bg-white/8 p-2 pr-4 text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <Avatar person={connection.person} size="sm" />

                <div>
                  <p className="text-sm font-medium">{connection.person.name}</p>
                  <p className="text-xs text-white/40">
                    {getConnectionLabel(connection.circles.length, connection.guestCircleCount)}
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
                {connection.circles.length} shared
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateCircleModal({
  contacts,
  onClose,
  onCreateCircle,
}: {
  contacts: Person[];
  onClose: () => void;
  onCreateCircle: (circle: Circle) => void;
}) {
  const [circleName, setCircleName] = useState("");
  const [selectedColor, setSelectedColor] = useState(circleColors[0]);
  const [coverType, setCoverType] = useState<CircleCoverType>("gradient");
  const [selectedCoverImage, setSelectedCoverImage] = useState(circleCoverImages[0]);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState("");   

  const selectedCount = selectedPeopleIds.length;
  const trimmedCircleName = circleName.trim();
const canCreate =
  trimmedCircleName.length > 1 &&
  trimmedCircleName.length <= MAX_CIRCLE_NAME_LENGTH &&
  selectedCount >= 1 &&
  selectedCount <= 8;
  const filteredContacts = contacts.filter((person) =>
  person.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
  person.email?.toLowerCase().includes(peopleSearch.toLowerCase())
);

  function togglePerson(personId: string) {

    setSelectedPeopleIds((currentIds) => {
      if (currentIds.includes(personId)) {
        return currentIds.filter((id) => id !== personId);
      }

      if (currentIds.length >= 8) {
        return currentIds;
      }

      return [...currentIds, personId];
    });
  }

  function handleCreate() {
    if (!canCreate) return;

    const members = selectedPeopleIds
      .map((personId) => contacts.find((person) => person.id === personId))
      .filter(Boolean) as Person[];

    const id = circleName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const newCircle: Circle = {
  id: `${id}-${Date.now()}`,
  name: trimmedCircleName,
  type: "Close Friends",
  color: selectedColor,
  coverType,
  coverImage: coverType === "image" ? selectedCoverImage.url : undefined,
  coverLabel: coverType === "image" ? selectedCoverImage.label : undefined,
  pulse: "Quiet",
  dailyPrompt: "What is your energy today?",
  members,
  posts: [],
  loop: [],
  guest: false,
};

<div className="mt-2 flex justify-end text-xs text-white/35">
  {circleName.length}/{MAX_CIRCLE_NAME_LENGTH}
</div>

    onCreateCircle(newCircle);
  }

  return (
    <div className="absolute inset-0 z-[200] bg-slate-950/70 px-5 py-8 backdrop-blur-2xl">
      <div className="flex h-full flex-col rounded-[3rem] border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">New Circle</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">Create a private orbit.</h2>
          </div>

          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-5 overflow-y-auto pr-1">
          <div>
            <label className="text-sm text-white/60">Circle name</label>
            <input
  value={circleName}
  maxLength={MAX_CIRCLE_NAME_LENGTH}
  onChange={(event) => setCircleName(event.target.value)}
              placeholder="High School Besties"
              className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>

          <div>
            <label className="text-sm text-white/60">Color</label>
            <div className="mt-2 flex gap-3">
              {circleColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${color} active:scale-95 ${
                    selectedColor === color ? "ring-4 ring-white/60" : "ring-1 ring-white/10"
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
  <label className="text-sm text-white/60">Circle look</label>

  <div className="mt-2 grid grid-cols-2 gap-2 rounded-full bg-white/8 p-2">
    <button
      onClick={() => setCoverType("gradient")}
      className={`rounded-full px-4 py-3 text-sm font-semibold active:scale-95 ${
        coverType === "gradient"
          ? "bg-white text-slate-950"
          : "text-white/55"
      }`}
    >
      Gradient
    </button>

    <button
      onClick={() => setCoverType("image")}
      className={`rounded-full px-4 py-3 text-sm font-semibold active:scale-95 ${
        coverType === "image"
          ? "bg-white text-slate-950"
          : "text-white/55"
      }`}
    >
      Cover Image
    </button>
  </div>

  {coverType === "gradient" && (
    <div className="mt-4 flex items-center gap-3 rounded-[2rem] border border-white/10 bg-white/8 p-4">
      <div
        className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${selectedColor} shadow-lg shadow-black/30`}
      >
        <div className="h-8 w-8 rounded-full bg-white/30 blur-sm" />
      </div>

      <div>
        <p className="text-sm font-semibold">Gradient cover</p>
        <p className="mt-1 text-xs text-white/45">
          Simple, abstract, and fast.
        </p>
      </div>
    </div>
  )}

  {coverType === "image" && (
    <div className="mt-4 space-y-3">
      <div className="relative h-36 overflow-hidden rounded-[2rem] border border-white/10 bg-white/8">
        <img
          src={selectedCoverImage.url}
          alt={selectedCoverImage.label}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/35" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/55">
            Selected cover
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {selectedCoverImage.label}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {circleCoverImages.map((cover) => (
          <button
            key={cover.label}
            onClick={() => setSelectedCoverImage(cover)}
            className={`relative h-24 overflow-hidden rounded-[1.5rem] border text-left active:scale-[0.98] ${
              selectedCoverImage.label === cover.label
                ? "border-white/60"
                : "border-white/10"
            }`}
          >
            <img
              src={cover.url}
              alt={cover.label}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/35" />
            <span className="absolute bottom-2 left-3 right-3 truncate text-sm font-semibold text-white">
              {cover.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )}
</div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/60">Your People</label>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">{selectedCount}/8</span>
            </div>

            <input
  value={peopleSearch}
  onChange={(event) => setPeopleSearch(event.target.value)}
  placeholder="Search your people..."
  className="mt-3 w-full rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
/>

            <div className="mt-3 grid gap-2">
              {filteredContacts.map((person) => {
                const selected = selectedPeopleIds.includes(person.id);
                const disabled = selectedPeopleIds.length >= 8 && !selected;

                return (
                  <button
                    key={person.id}
                    onClick={() => togglePerson(person.id)}
                    disabled={person.id === "brandon" || disabled}
                    className={`flex items-center justify-between rounded-full border p-2 pr-4 text-left active:scale-[0.99] ${
                      selected ? "border-white/25 bg-white/14" : "border-white/10 bg-white/7"
                    } ${disabled ? "opacity-35" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar person={person} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{person.name}</p>
                        {person.id === "brandon" && <p className="text-xs text-white/40">You</p>}
                      </div>
                    </div>

                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${selected ? "bg-white text-slate-950" : "bg-white/10 text-white/40"}`}>
                      {selected ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className={`mt-5 w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
            canCreate ? "bg-white text-slate-950" : "bg-white/10 text-white/30"
          }`}
        >
          Create Circle
        </button>
      </div>
    </div>
  );
}

function AddUpdateModal({
  circle,
  onClose,
  onAddPost,
}: {
  circle: Circle;
  onClose: () => void;
  onAddPost: (caption: string, mood: string, photoFile?: File) => void;
}) {
  const [caption, setCaption] = useState("");
  const [mood, setMood] = useState("present");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | undefined>();
const [photoFile, setPhotoFile] = useState<File | undefined>();
const [isPosting, setIsPosting] = useState(false);

  const moods = [
    "present",
    "chaotic calm",
    "main character",
    "low battery",
    "locked in",
    "recharging",
    "guest energy",
    "vacation brain",
  ];

  const canPost = Boolean(photoFile) || caption.trim().length > 1;

function handlePhotoSelect(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  const previewUrl = URL.createObjectURL(file);
  setPhotoFile(file);
  setPhotoPreviewUrl(previewUrl);
}

async function handlePost() {
  if (!canPost || isPosting) return;

  setIsPosting(true);

  try {
    await onAddPost(caption.trim(), mood, photoFile);
  } finally {
    setIsPosting(false);
  }
}

  return (
    <div className="fixed inset-0 z-[220] overflow-hidden bg-slate-950/80 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-h-full w-full max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black">
        <div className="shrink-0 border-b border-white/10 bg-slate-950/80 p-4 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm text-white/45">{circle.name}</p>
              <h2 className="mt-1 text-3xl font-semibold leading-tight tracking-tight">
                Add to today’s Orbit.
              </h2>
            </div>

            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/70 active:scale-95"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">
              Today’s Prompt
            </p>
            <p className="mt-2 text-xl font-semibold leading-7">
              {circle.dailyPrompt}
            </p>
          </div>

          <div className="mt-4">
            <label className="block cursor-pointer rounded-[2rem] border border-dashed border-white/20 bg-white/8 p-4 text-center active:scale-[0.99]">
              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt="Selected update"
                  className="h-64 w-full rounded-[1.5rem] object-cover"
                />
              ) : (
                <div className="grid h-48 place-items-center rounded-[1.5rem] bg-white/8">
                  <div>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-2xl text-slate-950">
                      +
                    </div>
                    <p className="mt-4 text-sm font-semibold text-white/80">
                      Add a photo
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Optional for now
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-3 text-sm text-white/45">
                {photoPreviewUrl ? "Tap to change photo" : "Choose from your phone"}
              </p>

              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-4">
            <label className="text-sm text-white/60">Caption</label>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="What do you want your Circle to know?"
              rows={4}
              className="mt-2 w-full resize-none rounded-[2rem] border border-white/10 bg-white/10 px-5 py-4 text-base leading-6 text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm text-white/60">Mood</label>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
              {moods.map((moodOption) => (
                <button
                  key={moodOption}
                  onClick={() => setMood(moodOption)}
                  className={`shrink-0 rounded-full border px-4 py-3 text-sm active:scale-95 ${
                    mood === moodOption
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/8 text-white/60"
                  }`}
                >
                  {moodOption}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6" />
        </div>

        <div className="shrink-0 border-t border-white/10 bg-slate-950/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-2xl">
          <button
            onClick={handlePost}
            disabled={!canPost || isPosting}
            className={`w-full rounded-full px-5 py-4 font-semibold active:scale-[0.98] ${
              canPost ? "bg-white text-slate-950" : "bg-white/10 text-white/30"
            }`}
          >
            {isPosting ? "Posting..." : "Post Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({
  activeTab,
  setActiveTab,
  requestCount,
}: {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  requestCount: number;
}) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "circles", label: "Circles" },
    { id: "orbit", label: "Orbit" },
    { id: "loops", label: "Loops" },
    { id: "people", label: "People" },
  ];

  return (
    <nav className="absolute bottom-5 left-3 right-3 z-50 rounded-full border border-white/10 bg-white/12 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const isActive =
            activeTab === tab.id ||
            (tab.id === "circles" && activeTab === "circleDetail");

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative rounded-full px-2 py-3 text-[11px] font-semibold transition active:scale-95 ${
                isActive ? "bg-white text-slate-950 shadow-lg" : "text-white/55"
              }`}
            >
              {tab.label}

              {tab.id === "people" && requestCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-200 px-1 text-[10px] font-black text-slate-950">
                  {requestCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}