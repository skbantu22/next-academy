"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";

const image = (id, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
const photos = {
  hero: image("photo-1523240795612-9a054b0db644"),
  about: image("photo-1523580846011-d3a5bc25702b"),
  leadership: image("photo-1556761175-b413da4baf72"),
  teaching: image("photo-1577896851231-70ef18881754"),
  community: image("photo-1531482615713-2afd69097998"),
  event: image("photo-1515169067868-5387ec356754"),
  workshop: image("photo-1517245386807-bb43f82c33c4"),
  galleryOne: image("photo-1524178232363-1fb2b075b655"),
  galleryTwo: image("photo-1529390079861-591de354faf5"),
  galleryThree: image("photo-1543269865-cbf427effbad"),
  learner: image("photo-1494790108377-be9c29b29330", 240),
  mentor: image("photo-1500648767791-00dcc994a43e", 240),
  teacher: image("photo-1534528741775-53994a69daeb", 240),
};

const programs = [
  {
    category: "Leadership",
    title: "Lead with clarity",
    copy: "Build the judgment, communication, and confidence to move people forward.",
    src: photos.leadership,
    color: "border-t-[#ee4d35]",
  },
  {
    category: "Teaching",
    title: "Teach for impact",
    copy: "Turn expertise into learning experiences that stay with people.",
    src: photos.teaching,
    color: "border-t-[#e88735]",
  },
  {
    category: "Community",
    title: "Grow together",
    copy: "Create stronger communities through empathy, collaboration, and action.",
    src: photos.community,
    color: "border-t-[#ee4d35]",
  },
  {
    category: "Career",
    title: "Build what is next",
    copy: "Develop practical skills for a changing world of work.",
    src: photos.workshop,
    color: "border-t-[#e88735]",
  },
];

const events = [
  ["18", "OCT", "Next Leaders Forum", "Phnom Penh · In person", photos.event],
  ["02", "NOV", "Teaching in Practice", "Online · 10:00 AM", photos.workshop],
  [
    "16",
    "NOV",
    "Community Showcase",
    "Next Academy campus",
    photos.galleryThree,
  ],
];

const stats = [
  ["5,300+", "students trained"],
  ["350+", "active learners"],
  ["50+", "training programs"],
  ["100+", "events hosted"],
  ["4,800+", "certificates earned"],
];

function Brand({ light = false }) {
  return (
    <a
      href="#home"
      className={`flex items-center gap-2 text-lg font-bold tracking-tight ${light ? "text-white" : "text-[#17191a]"}`}
    >
      <img
        src="/logo.jpeg"
        alt="Next Academy logo"
        className="h-8 w-8 rounded-[9px_9px_9px_2px] object-contain"
      />
      next
      <span className={light ? "-ml-2 text-[#ff806b]" : "-ml-2 text-[#ee4d35]"}>
        academy
      </span>
    </a>
  );
}

function Counter({ value, label, index }) {
  const [shown, setShown] = useState("0");
  useEffect(() => {
    const timer = setTimeout(() => setShown(value), 250 + index * 120);
    return () => clearTimeout(timer);
  }, [index, value]);
  return (
    <div className="border-l border-white/25 pl-4">
      <strong className="block font-serif text-4xl font-bold tracking-tight md:text-5xl">
        {shown}
      </strong>
      <span className="mt-2 block text-xs capitalize text-white/60">
        {label}
      </span>
    </div>
  );
}

export default function PublicSite() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const verifiedUser =
    user &&
    (user.emailVerified ||
      user.providerData?.some(
        (provider) => provider.providerId !== "password",
      ));

  function goToLearning() {
    router.push(
      verifiedUser && profile?.role
        ? `/dashboard/${profile.role.toLowerCase()}`
        : "/login",
    );
  }

  return (
    <main className="overflow-x-clip bg-[#f7f6f2] text-[#17191a]">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#17191a]/95 text-white shadow-lg shadow-black/5 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-10">
          <Brand light />
          <div
            className={`${menuOpen ? "absolute left-0 right-0 top-[72px] block border-t border-white/10 bg-[#17191a] px-5 py-5 shadow-2xl" : "hidden"} md:static md:flex md:items-center md:gap-8 md:border-0 md:bg-transparent md:p-0`}
          >
            <a
              href="#home"
              className="block py-2 text-sm text-white/70 transition hover:text-white"
            >
              Home
            </a>
            <a
              href="#training"
              className="block py-2 text-sm text-white/70 transition hover:text-white"
            >
              Training
            </a>
            <a
              href="#events"
              className="block py-2 text-sm text-white/70 transition hover:text-white"
            >
              Events
            </a>
            <a
              href="#about"
              className="block py-2 text-sm text-white/70 transition hover:text-white"
            >
              About
            </a>
            <a
              href="#contact"
              className="block py-2 text-sm text-white/70 transition hover:text-white"
            >
              Contact
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={goToLearning}
              className="rounded-full bg-[#ee4d35] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#ff684d]"
            >
              My Learning <span className="ml-2">↗</span>
            </button>
            {verifiedUser ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/10 text-xs font-bold text-white"
                >
                  {(profile?.displayName || user.email || "NA")
                    .slice(0, 2)
                    .toUpperCase()}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-12 w-48 rounded-lg border border-[#e3e8e3] bg-white p-3 text-[#17191a] shadow-xl">
                    <p className="border-b border-[#e3e8e3] pb-2 text-xs font-semibold">
                      {profile?.displayName || user.email}
                    </p>
                    <p className="py-2 text-[11px] text-[#77817d]">
                      {profile?.role || "Student"}
                    </p>
                    <button
                      onClick={logout}
                      className="w-full rounded-md px-2 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-white/70 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="hidden text-xs font-semibold text-white/70 hover:text-white sm:block"
                >
                  Register
                </Link>
              </div>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-2xl md:hidden"
              aria-label="Toggle navigation"
            >
              ☰
            </button>
          </div>
        </div>
        {menuOpen && !verifiedUser && (
          <div className="border-t border-white/10 bg-[#17191a] px-5 pb-5 md:hidden">
            <Link
              href="/register"
              className="block py-3 text-sm font-semibold text-white/80"
            >
              Register
            </Link>
          </div>
        )}
      </nav>

      <section
        id="home"
        className="relative min-h-[680px] bg-[#17191a] text-white"
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,25,26,.96)_10%,rgba(23,25,26,.78)_48%,rgba(23,25,26,.24)),url('https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=2000&q=85')] bg-cover bg-center" />
        <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-24 md:px-10">
          <div className="max-w-3xl">
            <p className="mb-7 font-mono text-[10px] uppercase tracking-[.25em] text-[#ff806b]">
              Next Academy · Learning for what comes next
            </p>
            <h1 className="max-w-3xl font-sans text-6xl font-black leading-[.92] tracking-[-.06em] md:text-8xl">
              Learn today.
              <br />
              <span className="text-[#ee4d35]">Lead tomorrow.</span>
            </h1>
            <p className="mt-8 max-w-lg text-base leading-7 text-white/70 md:text-lg">
              Practical learning for people building stronger careers,
              classrooms, and communities.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#training"
                className="rounded-full bg-[#ee4d35] px-6 py-3.5 text-sm font-bold transition hover:bg-[#ff684d]"
              >
                Explore programs <span className="ml-4">→</span>
              </a>
              <button
                onClick={goToLearning}
                className="rounded-full border border-white/30 px-6 py-3.5 text-sm font-bold transition hover:bg-white/10"
              >
                My Learning <span className="ml-4">↗</span>
              </button>
            </div>
          </div>
          <div className="absolute bottom-8 right-5 hidden max-w-xs border-l border-white/40 pl-4 text-xs leading-5 text-white/70 lg:block">
            A modern academy for curious people who want their learning to
            matter in the real world.
          </div>
        </div>
      </section>

      <section
        id="about"
        className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:grid-cols-[.8fr_1.2fr] md:items-center md:px-10 md:py-32"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#e88735]">
            About Next Academy
          </p>
          <h2 className="mt-5 max-w-lg text-4xl font-black leading-[.98] tracking-[-.04em] md:text-6xl">
            Building skills that create real opportunities.
          </h2>
          <p className="mt-7 max-w-md text-base leading-7 text-[#66706e]">
            We bring educators, practitioners, and changemakers together to make
            meaningful learning practical, human, and connected to the future
            people want to build.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-[1.25fr_.75fr]">
          <div className="group relative min-h-[430px] overflow-hidden rounded-2xl">
            <img
              src={photos.about}
              alt="Learners collaborating in a bright classroom"
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute bottom-5 left-5 rounded-lg bg-white/90 px-4 py-3 text-xs backdrop-blur">
              <b className="block">Our mission</b>
              <span className="text-[#66706e]">
                Make learning useful from day one.
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-end rounded-2xl bg-[#ee4d35] p-7 text-white">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/70">
              Our vision
            </span>
            <p className="mt-12 text-2xl font-bold leading-tight">
              A future where every learner can find their voice and strengthen
              the world around them.
            </p>
          </div>
        </div>
      </section>

      <section id="training" className="border-y border-[#dfdfda] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#e88735]">
                What we do
              </p>
              <h2 className="mt-5 text-4xl font-black tracking-[-.04em] md:text-6xl">
                Programs built around real needs.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-[#66706e]">
              Learn with purpose through programs shaped by people who do the
              work.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {programs.map((program) => (
              <article
                className={`group overflow-hidden rounded-2xl border border-[#dfdfda] border-t-4 ${program.color} bg-[#f7f6f2] transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
                key={program.title}
              >
                <div className="h-64 overflow-hidden">
                  <img
                    src={program.src}
                    alt={program.title}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-7">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#e88735]">
                    {program.category}
                  </p>
                  <h3 className="mt-4 text-3xl font-black tracking-tight">
                    {program.title}
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[#66706e]">
                    {program.copy}
                  </p>
                  <button className="mt-7 text-sm font-bold text-[#ee4d35]">
                    Learn more <span className="ml-3">→</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#17191a] text-white">
        <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#ff806b]">
            The numbers behind the work
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map(([value, label], index) => (
              <Counter key={label} value={value} label={label} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section
        id="events"
        className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#e88735]">
              Event calendar
            </p>
            <h2 className="mt-5 text-4xl font-black tracking-[-.04em] md:text-6xl">
              Learn, connect and grow together.
            </h2>
          </div>
          <a href="#contact" className="text-sm font-bold text-[#ee4d35]">
            View all events →
          </a>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {events.map(([day, month, title, detail, src]) => (
            <article
              className="group overflow-hidden rounded-2xl border border-[#dfdfda] bg-white"
              key={title}
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={src}
                  alt={title}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute left-4 top-4 bg-[#ee4d35] px-3 py-2 text-center text-white">
                  <b className="block font-serif text-2xl">{day}</b>
                  <small className="font-mono text-[9px]">{month}</small>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-2 text-xs text-[#66706e]">{detail}</p>
                <p className="mt-4 text-sm leading-6 text-[#66706e]">
                  A focused day of ideas, practical tools, and conversations
                  with people shaping what is next.
                </p>
                <button className="mt-6 text-sm font-bold text-[#ee4d35]">
                  View event →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#dfdfda] bg-[#f1eee7]">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:grid-cols-[.75fr_1.25fr] md:px-10 md:py-32">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#e88735]">
              Why Next Academy
            </p>
            <h2 className="mt-5 text-4xl font-black tracking-[-.04em] md:text-6xl">
              A better way to keep growing.
            </h2>
          </div>
          <div className="grid gap-0 sm:grid-cols-2">
            {[
              [
                "01",
                "Practical learning",
                "Every session connects ideas to action.",
              ],
              [
                "02",
                "Expert mentors",
                "Learn from people who have done the work.",
              ],
              [
                "03",
                "Career growth",
                "Build confidence that travels with you.",
              ],
              ["04", "Community", "Find people who make the journey richer."],
            ].map(([number, title, copy]) => (
              <div
                key={number}
                className="border-t border-[#cfcac0] py-7 sm:px-5"
              >
                <span className="font-mono text-xs text-[#ee4d35]">
                  {number}
                </span>
                <h3 className="mt-4 text-xl font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66706e]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:grid-cols-[1fr_1.3fr] md:items-center md:px-10 md:py-32">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#e88735]">
            Achievements
          </p>
          <h2 className="mt-5 text-4xl font-black tracking-[-.04em] md:text-6xl">
            Progress worth celebrating.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[#66706e]">
            From first certificates to community-wide recognition, every
            milestone is part of the story. Our learners leave with proof of
            what they can do.
          </p>
          <div className="mt-8 flex gap-8">
            <div>
              <strong className="block text-3xl font-black">1,850</strong>
              <span className="text-xs text-[#66706e]">
                certificates earned
              </span>
            </div>
            <div>
              <strong className="block text-3xl font-black">94%</strong>
              <span className="text-xs text-[#66706e]">completion rate</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative min-h-[300px] overflow-hidden rounded-2xl bg-[#17191a] p-6 text-white">
            <span className="text-5xl text-[#ff806b]">✦</span>
            <div className="absolute bottom-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/60">
                Award
              </p>
              <h3 className="mt-2 text-2xl font-black">Impact in action</h3>
            </div>
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl bg-[#ee4d35]">
            <img
              src={photos.learner}
              alt="Next Academy learner"
              className="h-52 w-full object-cover"
            />
            <div className="p-5 text-white">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/70">
                Success story
              </p>
              <p className="mt-3 text-sm font-bold">
                “I found the confidence to lead my first team.”
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#17191a] text-white">
        <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#ff806b]">
                Learner voices
              </p>
              <h2 className="mt-5 text-4xl font-black tracking-[-.04em] md:text-6xl">
                What our learners say.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-white/60">
              The best measure of our work is what people do with it next.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              [
                photos.learner,
                "Mina S.",
                "Leadership graduate",
                "The sessions gave me language for things I had felt but could not yet explain.",
              ],
              [
                photos.mentor,
                "Dara K.",
                "Teacher participant",
                "I left with tools I could use with my students the very next morning.",
              ],
              [
                photos.teacher,
                "Sophea R.",
                "Community fellow",
                "Next Academy feels ambitious and kind at the same time.",
              ],
            ].map(([src, name, role, quote]) => (
              <figure
                className="rounded-2xl border border-white/15 bg-white/5 p-6"
                key={name}
              >
                <img
                  src={src}
                  alt={name}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <blockquote className="mt-7 text-xl font-bold leading-8">
                  “{quote}”
                </blockquote>
                <figcaption className="mt-8 text-xs">
                  <b>{name}</b>
                  <span className="ml-2 text-white/50">{role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#e88735]">
              Activities / gallery
            </p>
            <h2 className="mt-5 text-4xl font-black tracking-[-.04em] md:text-6xl">
              Show up. Try things. Belong.
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-[#66706e]">
            Learning happens in classrooms, conversations, and all the moments
            between.
          </p>
        </div>
        <div className="mt-12 grid auto-rows-[160px] grid-cols-2 gap-4 md:grid-cols-4">
          <img
            src={photos.galleryOne}
            alt="Learners in a workshop"
            className="col-span-2 row-span-2 h-full w-full rounded-2xl object-cover"
          />
          <img
            src={photos.galleryTwo}
            alt="Academy discussion"
            className="h-full w-full rounded-2xl object-cover"
          />
          <img
            src={photos.galleryThree}
            alt="Group activity"
            className="h-full w-full rounded-2xl object-cover"
          />
          <div className="col-span-2 rounded-2xl bg-[#ee4d35] p-6 text-2xl font-black text-white md:text-3xl">
            Make room for
            <br />
            what comes next.
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#ee4d35] text-white">
        <div className="mx-auto max-w-7xl px-5 py-24 text-center md:px-10 md:py-32">
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-white/70">
            Start here
          </p>
          <h2 className="mx-auto mt-5 max-w-3xl text-5xl font-black leading-[.95] tracking-[-.05em] md:text-7xl">
            Ready to start your learning journey?
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a
              href="#training"
              className="rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#ee4d35]"
            >
              Explore programs →
            </a>
            <button
              onClick={goToLearning}
              className="rounded-full border border-white/50 px-6 py-3.5 text-sm font-bold text-white"
            >
              Join Next Academy ↗
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-[#17191a] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-10">
          <div>
            <Brand light />
            <p className="mt-5 max-w-xs text-sm leading-6 text-white/55">
              Practical learning for people building stronger careers,
              classrooms, and communities.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#ff806b]">
              Navigate
            </p>
            <div className="mt-4 grid gap-3 text-sm text-white/60">
              <a href="#home">Home</a>
              <a href="#training">Training</a>
              <a href="#events">Events</a>
              <a href="#about">About</a>
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#ff806b]">
              Programs
            </p>
            <div className="mt-4 grid gap-3 text-sm text-white/60">
              <a href="#training">Leadership</a>
              <a href="#training">Teaching</a>
              <a href="#training">Community</a>
              <a href="#training">Career</a>
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#ff806b]">
              Contact
            </p>
            <div className="mt-4 grid gap-3 text-sm text-white/60">
              <a href="mailto:hello@nextacademy.org">hello@nextacademy.org</a>
              <a href="#contact">Phnom Penh, Cambodia</a>
              <button onClick={goToLearning} className="text-left">
                My Learning →
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] text-white/35 md:px-10">
          © 2026 Next Academy. Learning for what comes next.
        </div>
      </footer>
    </main>
  );
}
