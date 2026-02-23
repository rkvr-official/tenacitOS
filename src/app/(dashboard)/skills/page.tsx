"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Puzzle,
  Package,
  FolderOpen,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";
import { SectionHeader, MetricCard } from "@/components/TenacitOS";

interface Skill {
  id: string;
  name: string;
  description: string;
  location: string;
  source: "workspace" | "system";
  homepage?: string;
  emoji?: string;
  fileCount: number;
  fullContent: string;
  files: string[];
  agents: string[];
}

interface SkillsData {
  skills: Skill[];
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData>({ skills: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "workspace" | "system">("all");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [hubCatalog, setHubCatalog] = useState<any[]>([]);
  const [hubPage, setHubPage] = useState(1);
  const [hubTotalPages, setHubTotalPages] = useState(1);
  const [hubPreview, setHubPreview] = useState<{ slug: string; content: string } | null>(null);
  const [hubPreviewLoading, setHubPreviewLoading] = useState(false);
  const [hubCategory, setHubCategory] = useState("all");

  useEffect(() => {
    try {
      const cached = localStorage.getItem('skills_page_cache');
      if (cached) setData(JSON.parse(cached));
    } catch {}

    fetch("/api/skills")
      .then((res) => res.json())
      .then((d) => { setData(d); try { localStorage.setItem('skills_page_cache', JSON.stringify(d)); } catch {} })
      .catch(() => setData((prev) => prev || { skills: [] }));
  }, []);
  useEffect(() => {
    fetch(`/api/skills/hub/explore?page=${hubPage}&pageSize=20&sort=installsAllTime`)
      .then((r) => r.json())
      .then((d) => {
        setHubCatalog(d.items || []);
        setHubTotalPages(d.totalPages || 1);
      })
      .catch(() => {
        setHubCatalog([]);
        setHubTotalPages(1);
      });
  }, [hubPage]);

  const { skills } = data;

  // Filter skills
  let filteredSkills = skills;

  if (filterSource !== "all") {
    filteredSkills = filteredSkills.filter((s) => s.source === filterSource);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredSkills = filteredSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.id.toLowerCase().includes(query)
    );
  }

  // Group by source
  const workspaceSkills = filteredSkills.filter((s) => s.source === "workspace");
  const systemSkills = filteredSkills.filter((s) => s.source === "system");

  const workspaceCount = skills.filter((s) => s.source === "workspace").length;
  const systemCount = skills.filter((s) => s.source === "system").length;

  // marketplace search removed by design; catalog browse only.

  const installFromHub = async (slug: string) => {
    await fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const refreshed = await fetch('/api/skills').then((r) => r.json());
    setData(refreshed);
  };

  const previewSkillMd = async (slug: string) => {
    setHubPreviewLoading(true);
    try {
      const data = await fetch(`/api/skills/hub/skill-md?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      setHubPreview({ slug, content: data.content || 'No content' });
    } finally {
      setHubPreviewLoading(false);
    }
  };


  const categoryOf = (h: any) => {
    const t = `${h.slug || ''} ${h.displayName || ''} ${h.summary || ''}`.toLowerCase();
    if (/github|git|code|dev|terminal|tmux|api|mcp/.test(t)) return 'dev';
    if (/gmail|calendar|notion|docs|sheets|drive|office|product/.test(t)) return 'productivity';
    if (/image|video|pdf|audio|voice|whisper|tts|gif/.test(t)) return 'media';
    if (/slack|telegram|discord|whatsapp|email|himalaya/.test(t)) return 'communication';
    if (/security|healthcheck|auth|password/.test(t)) return 'security';
    if (/weather|sleep|blu|places|home|eight/.test(t)) return 'home';
    return 'other';
  };

  const filteredHubCatalog = hubCatalog.filter((h: any) => hubCategory === 'all' ? true : categoryOf(h) === hubCategory);

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-1px",
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          Skills Manager
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--text-secondary)",
          }}
        >
          Skills disponibles en el sistema OpenClaw
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <MetricCard icon={Puzzle} value={skills.length} label="Total Skills" />
        <MetricCard
          icon={FolderOpen}
          value={workspaceCount}
          label="Workspace Skills"
          changeColor="positive"
        />
        <MetricCard
          icon={Package}
          value={systemCount}
          label="System Skills"
          changeColor="secondary"
        />
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "16px",
              height: "16px",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            placeholder="Buscar skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: "40px",
              paddingRight: "16px",
              paddingTop: "12px",
              paddingBottom: "12px",
              borderRadius: "6px",
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
            }}
          />
        </div>

        {/* Source Filter */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setFilterSource("all")}
            style={{
              padding: "12px 20px",
              borderRadius: "6px",
              backgroundColor: filterSource === "all" ? "var(--accent-soft)" : "var(--surface)",
              color: filterSource === "all" ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Todas ({skills.length})
          </button>
          <button
            onClick={() => setFilterSource("workspace")}
            style={{
              padding: "12px 20px",
              borderRadius: "6px",
              backgroundColor: filterSource === "workspace" ? "var(--accent-soft)" : "var(--surface)",
              color: filterSource === "workspace" ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Workspace ({workspaceCount})
          </button>
          <button
            onClick={() => setFilterSource("system")}
            style={{
              padding: "12px 20px",
              borderRadius: "6px",
              backgroundColor: filterSource === "system" ? "var(--accent-soft)" : "var(--surface)",
              color: filterSource === "system" ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            System ({systemCount})
          </button>
        </div>
      </div>

      {/* ClawHub Catalog */}
      <div style={{ marginBottom: 24 }}>
        <SectionHeader label="CLAWHUB CATALOG" />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, marginBottom: 12 }}>
          {(["all","dev","productivity","media","communication","security","home","other"] as const).map((c) => (
            <button key={c} onClick={() => setHubCategory(c)} style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid var(--border)", backgroundColor: hubCategory === c ? "var(--accent-soft)" : "var(--surface-elevated)", color: hubCategory === c ? "var(--accent)" : "var(--text-secondary)", fontSize: 11 }}>
              {c}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "12px",
          }}
        >
          {filteredHubCatalog.map((h: any) => (
            <ClawHubSkillCard
              key={h.slug}
              skill={h}
              loadingPreview={hubPreviewLoading}
              onPreview={() => previewSkillMd(h.slug)}
              onInstall={() => installFromHub(h.slug)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <button onClick={() => setHubPage((p) => Math.max(1, p - 1))} disabled={hubPage === 1} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Prev</button>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Page {hubPage} / {hubTotalPages}</div>
          <button onClick={() => setHubPage((p) => Math.min(hubTotalPages, p + 1))} disabled={hubPage === hubTotalPages} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Next</button>
        </div>
      </div>

      {/* Skills List */}
      {filteredSkills.length === 0 ? (
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <Puzzle
            style={{
              width: "48px",
              height: "48px",
              color: "var(--text-muted)",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "var(--text-secondary)" }}>No se encontraron skills</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Workspace Skills */}
          {workspaceSkills.length > 0 && (filterSource === "all" || filterSource === "workspace") && (
            <div>
              <SectionHeader label="WORKSPACE SKILLS" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                {workspaceSkills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onClick={() => setSelectedSkill(skill)} />
                ))}
              </div>
            </div>
          )}

          {/* System Skills */}
          {systemSkills.length > 0 && (filterSource === "all" || filterSource === "system") && (
            <div>
              <SectionHeader label="SYSTEM SKILLS" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                {systemSkills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onClick={() => setSelectedSkill(skill)} />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
      {/* Detail Modal */}
      {selectedSkill && <SkillDetailModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />}

      {hubPreview && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setHubPreview(null)}>
          <div style={{ width: 'min(1000px, 95vw)', maxHeight: '90vh', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>SKILL.md Preview · {hubPreview.slug}</div>
              <button onClick={() => setHubPreview(null)} style={{ color: 'var(--text-secondary)' }}>Close</button>
            </div>
            <textarea readOnly value={hubPreview.content} style={{ width: '100%', height: '70vh', backgroundColor: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Skill Card Component
function SkillCard({ skill, onClick }: { skill: Skill; onClick: () => void }) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        borderRadius: "8px",
        padding: "16px",
        border: "1px solid var(--border)",
        cursor: "pointer",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface-hover)";
        e.currentTarget.style.borderColor = "var(--border-strong)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
      onClick={onClick}
    >
      {/* Skill Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        {skill.emoji && (
          <span style={{ fontSize: "24px", flexShrink: 0 }}>{skill.emoji}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            {skill.name}
          </h3>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: "1.5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {skill.description}
          </p>
        </div>
      </div>

      {/* Skill Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "12px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <div
            style={{
              backgroundColor:
                skill.source === "workspace" ? "var(--accent-soft)" : "var(--surface-elevated)",
              color: skill.source === "workspace" ? "var(--accent)" : "var(--text-muted)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontFamily: "var(--font-body)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {skill.source}
          </div>
          {skill.agents && skill.agents.length > 0 && skill.agents.map((agent) => (
            <div
              key={agent}
              style={{
                backgroundColor: "var(--surface-elevated)",
                color: "var(--text-secondary)",
                padding: "3px 7px",
                borderRadius: "4px",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                fontWeight: 600,
                border: "1px solid var(--border)",
              }}
            >
              {agent}
            </div>
          ))}
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              color: "var(--text-muted)",
            }}
          >
            {skill.fileCount} files
          </span>
        </div>
        {skill.homepage && (
          <ExternalLink style={{ width: "14px", height: "14px", color: "var(--text-muted)" }} />
        )}
      </div>
    </div>
  );
}

function ClawHubSkillCard({
  skill,
  onPreview,
  onInstall,
  loadingPreview,
}: {
  skill: any;
  onPreview: () => void;
  onInstall: () => void;
  loadingPreview: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        borderRadius: "8px",
        padding: "16px",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>🧩</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            {skill.displayName || skill.name || skill.slug}
          </h3>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: "1.5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {skill.summary || "ClawHub skill"}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-muted)", padding: "3px 8px", borderRadius: 4, fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            clawhub
          </div>
          <div style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)", padding: "3px 7px", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, border: "1px solid var(--border)" }}>
            {skill.slug}
          </div>
          {skill.tags?.latest && (
            <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--text-muted)" }}>v{skill.tags.latest}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onPreview} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", backgroundColor: "var(--surface-elevated)", color: "var(--text-primary)", cursor: "pointer", fontSize: 11 }}>
            {loadingPreview ? "Loading…" : "Preview"}
          </button>
          <button onClick={onInstall} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", backgroundColor: "var(--accent-soft)", color: "var(--accent)", cursor: "pointer", fontSize: 11 }}>
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

// Skill Detail Modal Component
function SkillDetailModal({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          maxWidth: "800px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid var(--border)",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              padding: "8px",
              borderRadius: "6px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X style={{ width: "20px", height: "20px" }} />
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", paddingRight: "40px" }}>
            {skill.emoji && <span style={{ fontSize: "48px" }}>{skill.emoji}</span>}
            <div style={{ flex: 1 }}>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                {skill.name}
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  marginBottom: "12px",
                }}
              >
                {skill.description}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <div className="badge-positive">{skill.source}</div>
                <div className="badge-info">{skill.fileCount} archivos</div>
                {skill.agents && skill.agents.length > 0 && skill.agents.map((agent) => (
                  <div
                    key={agent}
                    style={{
                      backgroundColor: "var(--surface-elevated)",
                      color: "var(--text-secondary)",
                      padding: "3px 10px",
                      borderRadius: "4px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: "1px solid var(--border)",
                    }}
                  >
                    @{agent}
                  </div>
                ))}
                {skill.homepage && (
                  <a
                    href={skill.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--accent)",
                      fontSize: "12px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Homepage <ExternalLink style={{ width: "12px", height: "12px" }} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px" }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "12px",
            }}
          >
            Archivos ({skill.files.length})
          </h3>
          <div
            style={{
              backgroundColor: "var(--bg)",
              borderRadius: "8px",
              padding: "16px",
              maxHeight: "400px",
              overflow: "auto",
            }}
          >
            {skill.files.map((file) => (
              <div
                key={file}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  padding: "4px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FileText style={{ width: "14px", height: "14px", color: "var(--text-muted)", flexShrink: 0 }} />
                {file}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
