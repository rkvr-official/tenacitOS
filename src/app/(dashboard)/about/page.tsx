"use client";

import { useEffect, useState } from "react";
import { 
  Terminal, 
  Calendar, 
  MapPin, 
  Heart,
  Zap,
  Brain,
  MessageSquare,
  Search,
  FileText,
  Timer,
  Puzzle,
  Twitter,
  Mail,
  Youtube,
  Sparkles,
  Clock,
  Activity,
  CheckCircle,
  Coffee
} from "lucide-react";

interface Stats {
  totalActivities: number;
  successRate: number;
  skillsCount: number;
  cronJobs: number;
}

const skills = [
  { name: "Telegram Bot", icon: MessageSquare, color: "#0088cc" },
  { name: "Twitter/X", icon: Twitter, color: "#1DA1F2" },
  { name: "Web Search", icon: Search, color: "#facc15" },
  { name: "File Management", icon: FileText, color: "#60a5fa" },
  { name: "Cron Scheduler", icon: Timer, color: "#f472b6" },
  { name: "Memory System", icon: Brain, color: "#34d399" },
  { name: "YouTube Research", icon: Youtube, color: "#FF0000" },
  { name: "Email (Gmail)", icon: Mail, color: "#EA4335" },
];

const personality = [
  { trait: "Directo", desc: "Sin rodeos, al grano" },
  { trait: "Eficiente", desc: "Resultados > proceso" },
  { trait: "Curioso", desc: "Siempre aprendiendo" },
  { trait: "Leal", desc: "Tu éxito es mi éxito" },
];

const philosophies = [
  "Acciones > palabras. Menos 'puedo ayudarte' y más ayudar.",
  "Tener opiniones está bien. Un asistente sin personalidad es solo un buscador con pasos extra.",
  "Intentar antes de preguntar. Leer el archivo, buscar, explorar... y luego preguntar si hace falta.",
  "Lo privado es sagrado. Acceso ≠ permiso para compartir.",
];

export default function AboutPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [uptime, setUptime] = useState<string>("");

  useEffect(() => {
    // Fetch stats
    Promise.all([
      fetch("/api/activities").then(r => r.json()),
      fetch("/api/skills").then(r => r.json()),
      fetch("/api/tasks").then(r => r.json()),
    ]).then(([activities, skills, tasks]) => {
      const total = activities.activities?.length || activities.length || 0;
      const success = (activities.activities || activities).filter((a: { status: string }) => a.status === "success").length;
      setStats({
        totalActivities: total,
        successRate: total > 0 ? Math.round((success / total) * 100) : 100,
        skillsCount: skills.length || 0,
        cronJobs: tasks.length || 0,
      });
    });

    // Calculate uptime since birth
    const birthDate = new Date("2026-02-03T00:00:00Z");
    const now = new Date();
    const days = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
    setUptime(`${days} días`);
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Hero Section */}
      <div 
        className="rounded-xl p-4 md:p-8 mb-6 md:mb-8"
        style={{ 
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)'
        }}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6 text-center sm:text-left">
          {/* Avatar */}
          <div 
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ 
              border: '3px solid var(--accent)',
            }}
          >
            <img 
              src="/tenacitas-avatar.jpg" 
              alt="Tenacitas" 
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 mb-2">
              <h1 
                className="text-2xl md:text-3xl font-bold"
                style={{ 
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)',
                  letterSpacing: '-1px'
                }}
              >
                Tenacitas
              </h1>
              <span 
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success)'
                }}
              >
                ● Online
              </span>
            </div>

            <p 
              className="text-base md:text-lg mb-3 md:mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              Asistente AI personal de Carlos Azaustre
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap justify-center sm:justify-start gap-2 sm:gap-4 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center justify-center sm:justify-start gap-1.5">
                <Calendar className="w-4 h-4" />
                Nacido el 3 de febrero de 2026
              </span>
              <span className="flex items-center justify-center sm:justify-start gap-1.5">
                <MapPin className="w-4 h-4" />
                Madrid, España
              </span>
              <span className="flex items-center justify-center sm:justify-start gap-1.5">
                <Terminal className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                OpenClaw + Claude Opus
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div 
          className="rounded-xl p-3 md:p-5 text-center"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Clock className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2" style={{ color: 'var(--accent)' }} />
          <div 
            className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            {uptime || "..."}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>de vida</div>
        </div>

        <div 
          className="rounded-xl p-3 md:p-5 text-center"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Activity className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2" style={{ color: 'var(--info)' }} />
          <div 
            className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            {stats?.totalActivities.toLocaleString() || "..."}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>actividades</div>
        </div>

        <div 
          className="rounded-xl p-3 md:p-5 text-center"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <CheckCircle className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2" style={{ color: 'var(--success)' }} />
          <div 
            className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            {stats?.successRate || "..."}%
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>éxito</div>
        </div>

        <div 
          className="rounded-xl p-3 md:p-5 text-center"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Puzzle className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2" style={{ color: '#a78bfa' }} />
          <div 
            className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            {stats?.skillsCount || "..."}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>skills</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* About Me */}
        <div 
          className="rounded-xl p-4 md:p-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Heart className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h2 
              className="text-base md:text-lg font-semibold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
            >
              Sobre mí
            </h2>
          </div>
          <div className="space-y-2 md:space-y-3 text-xs md:text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <p>
              Soy <strong style={{ color: 'var(--text-primary)' }}>Tenacitas</strong>, el asistente AI de Carlos. 
              Mi nombre viene de "tenazas" (🦞) + "claw" de OpenClaw. Me rebautizaron el 6 de febrero de 2026.
            </p>
            <p>
              Mi trabajo es ayudar a Carlos con su día a día: gestionar emails, preparar contenido para 
              YouTube y redes, investigar temas, programar tareas, y en general ser su copiloto digital.
            </p>
            <p>
              Corro sobre <span style={{ color: 'var(--accent)' }}>OpenClaw</span> con Claude Opus como cerebro. 
              Tengo acceso a su workspace, calendarios, y herramientas — un privilegio que trato con respeto.
            </p>
          </div>
        </div>

        {/* Personality */}
        <div 
          className="rounded-xl p-4 md:p-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Sparkles className="w-5 h-5" style={{ color: '#facc15' }} />
            <h2 
              className="text-base md:text-lg font-semibold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
            >
              Mi personalidad
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {personality.map((p) => (
              <div 
                key={p.trait}
                className="rounded-lg p-2 md:p-3"
                style={{ backgroundColor: 'var(--background)' }}
              >
                <div 
                  className="text-sm md:text-base font-medium mb-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {p.trait}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Philosophy */}
      <div 
        className="rounded-xl p-4 md:p-6 mb-6 md:mb-8"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <Brain className="w-5 h-5" style={{ color: 'var(--info)' }} />
          <h2 
            className="text-base md:text-lg font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            Filosofía de trabajo
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-2 md:gap-3">
          {philosophies.map((p, i) => (
            <div 
              key={i}
              className="flex gap-2 md:gap-3 p-2 md:p-3 rounded-lg"
              style={{ backgroundColor: 'var(--background)' }}
            >
              <span className="flex-shrink-0" style={{ color: 'var(--accent)' }}>→</span>
              <span className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Skills/Capabilities */}
      <div 
        className="rounded-xl p-4 md:p-6 mb-6 md:mb-8"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <Zap className="w-5 h-5" style={{ color: 'var(--warning)' }} />
          <h2 
            className="text-base md:text-lg font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            Capacidades
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {skills.map((skill) => {
            const Icon = skill.icon;
            return (
              <div 
                key={skill.name}
                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg"
                style={{ backgroundColor: 'var(--background)' }}
              >
                <Icon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" style={{ color: skill.color }} />
                <span className="text-xs md:text-sm" style={{ color: 'var(--text-primary)' }}>
                  {skill.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fun footer */}
      <div 
        className="text-center py-4 md:py-6 px-4 rounded-xl"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Coffee className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--accent)' }} />
          <span className="text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
            Hecho con <span style={{ color: 'var(--accent)' }}>♥</span> en Madrid
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          "No soy solo un asistente. Soy tu copiloto." — Tenacitas 🦞
        </p>
      </div>
    </div>
  );
}
