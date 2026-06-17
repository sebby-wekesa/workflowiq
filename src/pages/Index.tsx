import { Link } from "react-router-dom";
import { useAuth } from "@/components/providers/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DiscIcon,
  WrenchIcon,
  TruckIcon,
  PackageIcon,
  UsersIcon,
  BarChart3Icon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  CameraIcon,
  ZapIcon,
} from "lucide-react";
import { motion } from "framer-motion";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1564030390658-84b5d8fed479?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwxfHxicmFrZSUyMHNob2UlMjByZWxpbmluZyUyMHdvcmtzaG9wJTIwaW5kdXN0cmlhbCUyMGF1dG9tb3RpdmUlMjByZXBhaXJ8ZW58MHx8fHwxNzc1NTUwNzg3fDA&ixlib=rb-4.1.0&q=80&w=1080";

const WORKSHOP_IMAGE =
  "https://images.unsplash.com/photo-1720036236697-018370867320?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw0fHxpbmR1c3RyaWFsJTIwd29ya3Nob3AlMjBtYWNoaW5lcnklMjBkYXJrJTIwbW9vZHklMjBtYW51ZmFjdHVyaW5nfGVufDB8fHx8MTc3NTU1MDc5OHww&ixlib=rb-4.1.0&q=80&w=1080";

const FEATURES = [
  {
    icon: WrenchIcon,
    title: "Job Tracking",
    description:
      "Track every brake shoe from intake to collection with a clear 6-stage workflow pipeline.",
  },
  {
    icon: TruckIcon,
    title: "Delivery Management",
    description:
      "Record collections with full handover details — what was delivered, when, and by whom.",
  },
  {
    icon: PackageIcon,
    title: "Stock Control",
    description:
      "Monitor lining materials, rivets, and consumables with automatic low-stock alerts.",
  },
  {
    icon: UsersIcon,
    title: "Customer Database",
    description:
      "Build a complete history for every client. Spot returning customers instantly.",
  },
  {
    icon: BarChart3Icon,
    title: "Live Dashboard",
    description:
      "See active jobs, pipeline status, staff workload, and overdue items at a glance.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Role-Based Access",
    description:
      "Admins and Managers with controlled permissions. Secure without the hassle.",
  },
];

const WORKFLOW_STEPS = [
  { label: "Received", color: "bg-blue-500" },
  { label: "Workshop", color: "bg-amber-500" },
  { label: "Relining", color: "bg-purple-500" },
  { label: "QC", color: "bg-orange-500" },
  { label: "Done", color: "bg-emerald-500" },
  { label: "Collected", color: "bg-gray-400" },
];

const STATS = [
  { value: "6-Stage", label: "Job Pipeline" },
  { value: "Real-time", label: "Dashboard" },
  { value: "100%", label: "Cloud Based" },
  { value: "Multi-role", label: "Access Control" },
];

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
              <DiscIcon className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">WorkflowIq</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Features
            </a>
            <a
              href="#workflow"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Workflow
            </a>
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : isAuthenticated ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  Dashboard
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/sign-in">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 min-h-[90vh] flex items-center overflow-hidden">
        {/* Background image with dark overlay */}
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28 w-full">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-white/80 mb-6">
                <DiscIcon className="size-4" />
                Workshop Management System
              </div>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Every job.{" "}
              <span className="text-amber-400">Tracked.</span>
              <br />
              Every brake shoe.{" "}
              <span className="text-emerald-400">Accounted for.</span>
            </motion.h1>

            <motion.p
              className="mt-6 text-lg md:text-xl text-white/70 max-w-lg"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              WorkflowIq is the complete management system built for brake shoe
              relining workshops. From intake to collection, know exactly where
              every job stands.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-col sm:flex-row items-start gap-4"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {isLoading ? (
                <Skeleton className="h-12 w-44 bg-white/10" />
              ) : isAuthenticated ? (
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    Open Dashboard
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to="/sign-in">
                    Get Started Free
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              )}
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium py-3 cursor-pointer"
              >
                See how it works
                <ArrowRightIcon className="size-4" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <p className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow section */}
      <section id="workflow" className="py-20 md:py-28 px-6 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground mb-4">
              <ClipboardListIcon className="size-4 text-primary" />
              6-Stage Pipeline
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              From intake to collection
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Every job flows through a clear, trackable pipeline. Never lose
              sight of where a brake shoe is in the process.
            </p>
          </motion.div>

          {/* Pipeline visualization */}
          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-12 left-[8%] right-[8%] h-0.5 bg-border" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-3">
              {WORKFLOW_STEPS.map((step, i) => (
                <motion.div
                  key={step.label}
                  className="flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <div
                    className={`relative z-10 flex size-24 items-center justify-center rounded-2xl ${step.color} text-white text-3xl font-bold shadow-lg`}
                  >
                    {i + 1}
                  </div>
                  <p className="mt-3 text-sm font-semibold">{step.label}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2Icon className="size-3" />
                    Tracked
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28 px-6 bg-muted/40 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: image */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl border">
                <img
                  src={WORKSHOP_IMAGE}
                  alt="Industrial workshop"
                  className="w-full h-[400px] object-cover"
                />
              </div>
              {/* Floating card */}
              <motion.div
                className="absolute -bottom-6 -right-4 md:-right-8 bg-card border rounded-xl p-4 shadow-xl max-w-[220px]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CameraIcon className="size-4 text-primary" />
                  <span className="text-xs font-semibold">Photo Notes</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Attach before/after photos and progress notes to every job.
                </p>
              </motion.div>
            </motion.div>

            {/* Right: feature cards */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Everything your workshop needs
                </h2>
                <p className="mt-4 text-muted-foreground">
                  From the moment a customer walks in to the final handover,
                  WorkflowIq has you covered.
                </p>
              </motion.div>

              <div className="mt-8 grid gap-4">
                {FEATURES.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    className="flex items-start gap-4 rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights section */}
      <section className="py-20 md:py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Built for the way workshops work
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              No more paper logs, spreadsheets, or guesswork. WorkflowIq brings
              structure to your operations.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: ZapIcon,
                title: "Instant Status Updates",
                description:
                  "Advance jobs through the pipeline with a single click. The whole team sees changes in real-time.",
              },
              {
                icon: CameraIcon,
                title: "Photo Documentation",
                description:
                  "Snap before and after photos directly from your phone. Every image is linked to the right job.",
              },
              {
                icon: ClipboardListIcon,
                title: "Printable Job Cards",
                description:
                  "Generate and print job cards for the workshop floor. All the details your technicians need.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="relative rounded-2xl border bg-card p-8 overflow-hidden group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[60px] transition-colors group-hover:bg-primary/10" />
                <div className="relative">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 mb-5">
                    <item.icon className="size-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 px-6">
        <motion.div
          className="relative mx-auto max-w-4xl text-center rounded-3xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-primary" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-black/40" />

          <div className="relative px-8 py-16 md:px-16 md:py-20">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-foreground">
              Ready to streamline your workshop?
            </h2>
            <p className="mt-4 text-primary-foreground/70 max-w-md mx-auto text-lg">
              Sign in to get started. The first user automatically becomes an
              Admin.
            </p>
            <div className="mt-10">
              {isLoading ? (
                <Skeleton className="h-12 w-48 mx-auto bg-white/10" />
              ) : isAuthenticated ? (
                <Button asChild size="lg" variant="secondary">
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" variant="secondary">
                  <Link to="/sign-in">
                    Get Started with WorkflowIq
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <DiscIcon className="size-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">WorkflowIq</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {"© "}
            {new Date().getFullYear()}
            {" WorkflowIq. All rights reserved."}
          </p>
        </div>
      </footer>
    </div>
  );
}
