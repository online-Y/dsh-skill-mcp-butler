/**
 * dsh-skill-mcp-studio — client half.
 *
 * Bundle-plugin client half: `window.__ModuleLoader__.load({ id, factory })`.
 * RPC: `POST /plugins/dsh-skill-mcp-studio/rpc` with `{ method, args }`.
 * Surface: full-screen overlay in `shell.overlay` + launcher in the session header.
 */
window.__ModuleLoader__.load({
  id: 'dsh-skill-mcp-butler',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const react = require('react');
    const h = react.createElement;
    const { useState, useEffect, useMemo, useRef, useCallback } = react;

    // Phase 1 (coexist): the studio delegates every read/write to the existing
    // dsh-skills-mcp-group-manager RPC, so there is exactly one state file and
    // one skill-catalog filter while the new UI is being evaluated.
    // Phase 2 (self-hosted): point RPC_PATH at `/plugins/dsh-skill-mcp-studio/rpc`
    // and drop METHOD_MAP after the old plugin is disabled.
    // Phase 1 (coexist): delegate to the existing group-manager RPC.
    // Phase 2 (self-hosted): the studio's own RPC is present; use it instead.
    // The backend is probed once and cached, so switching phases needs no
    // client edit.
    const OWN_RPC = '/plugins/dsh-skill-mcp-studio/rpc';
    const LEGACY_RPC = '/plugins/dsh-skills-mcp-group-manager/rpc';
    const METHOD_MAP = {
      'studio.state.get': 'manager.state.get',
      'studio.skills.list': 'manager.skills.list',
      'studio.groups.create': 'manager.groups.create',
      'studio.groups.rename': 'manager.groups.rename',
      'studio.groups.delete': 'manager.groups.delete',
      'studio.groups.setEnabled': 'manager.groups.setEnabled',
      'studio.groups.addSkill': 'manager.groups.addSkill',
      'studio.groups.removeSkill': 'manager.groups.removeSkill',
      'studio.mcp.list': 'manager.mcp.list',
      'studio.mcp.toggle': 'manager.mcp.toggle',
      'studio.mcp.add': 'manager.mcp.add',
      'studio.mcp.remove': 'manager.mcp.remove',
    };
    let backend = null;

    /** Reserved group used for per-skill switches (hidden from the UI). */
    const DIRECT_GROUP = '单独启用';

    async function post(path, payload) {
      let res;
      try {
        res = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        throw new Error('无法连接 DSH 宿主：' + String((error && error.message) || error));
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('宿主返回 HTTP ' + res.status);
      const data = await res.json().catch(() => { throw new Error('宿主返回了非 JSON 响应'); });
      return data;
    }

    async function rpc(method, args) {
      const payloadArgs = args || {};
      if (backend === null) {
        const probe = await post(OWN_RPC, { method: 'studio.state.get', args: {} }).catch(() => null);
        backend = probe && probe.ok === true ? 'own' : 'legacy';
      }
      const path = backend === 'own' ? OWN_RPC : LEGACY_RPC;
      const name = backend === 'own' ? method : (METHOD_MAP[method] || method);
      const data = await post(path, { method: name, args: payloadArgs });
      if (!data) throw new Error('找不到可用的管理后端（旧插件与新宿主均未启用）');
      if (data.ok !== true) throw new Error(data.error || '未知错误');
      return data.value;
    }
    const ui = { open: false, listeners: new Set() };
    function setOpen(next) {
      if (ui.open === next) return;
      ui.open = next;
      ui.listeners.forEach((listener) => listener(next));
    }
    function useOpen() {
      const [value, setValue] = useState(ui.open);
      useEffect(() => {
        const listener = (next) => setValue(next);
        ui.listeners.add(listener);
        return () => { ui.listeners.delete(listener); };
      }, []);
      return value;
    }

    const ICONS = {
      search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
      close: '<path d="M6 6l12 12M18 6 6 18"/>',
      refresh: '<path d="M20.5 11a8.5 8.5 0 1 0-2.4 5.9"/><path d="M20.5 5v6h-6"/>',
      grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
      trash: '<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/>',
      edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
      layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
      folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
      plug: '<path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0V9zM12 18v3"/>',
      grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
      bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
      warn: '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10v4M12 17h.01"/>',
      box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
      minimize: '<path d="M5 12h14"/>',
      maximize: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
      restore: '<rect x="8" y="8" width="10" height="10" rx="1.5"/><path d="M4 15V5a1 1 0 0 1 1-1h10"/>',
    };

    function Icon(props) {
      const size = props.size === undefined ? 16 : props.size;
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
        dangerouslySetInnerHTML: { __html: ICONS[props.name] || '' },
      });
    }

    const CSS = `
.sms-root{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.34);backdrop-filter:blur(2px);animation:sms-in .14s ease-out}
.sms-window{position:relative;width:min(1060px,94vw);height:min(700px,88vh);display:flex;flex-direction:column;overflow:hidden;border-radius:16px;border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.1));background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-module,#f4f5f7));color:var(--dsw-alias-label-primary,#1f2329);font:12.5px/1.5 system-ui,-apple-system,"Segoe UI","Microsoft YaHei UI",sans-serif;box-shadow:0 24px 80px rgba(0,0,0,.35)}
.sms-window.max{width:100%;height:100%;border-radius:12px}
.sms-winbtn{width:26px;height:26px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#5f6672);display:grid;place-items:center;cursor:pointer}
.sms-winbtn:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.07))}
.sms-winbtn.close:hover{background:rgba(220,60,60,.14);color:#d33}
.sms-pill{position:fixed;right:24px;bottom:24px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:#1f2329;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.28);cursor:pointer;font:12px/1.4 system-ui,-apple-system,"Segoe UI","Microsoft YaHei UI",sans-serif}
.sms-pill:hover{filter:brightness(1.08)}
@keyframes sms-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.sms-head{display:flex;align-items:center;gap:16px;padding:14px 22px;flex:0 0 auto;background:var(--dsw-alias-bg-module,#fff);border-bottom:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.08))}
.sms-brand{display:flex;align-items:center;gap:11px;min-width:210px}
.sms-logo{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#3b6cf6,#7a5cff);box-shadow:0 2px 8px rgba(59,108,246,.35)}
.sms-title{font-weight:680;font-size:14.5px}
.sms-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8a9099)}
.sms-search{flex:1;max-width:560px;display:flex;align-items:center;gap:8px;padding:0 12px;height:36px;border-radius:10px;border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.1));background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.03));color:var(--dsw-alias-label-tertiary,#8a9099);transition:border-color .12s,box-shadow .12s}
.sms-search:focus-within{border-color:#3b6cf6;box-shadow:0 0 0 3px rgba(59,108,246,.14)}
.sms-search input{flex:1;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary,#1f2329);font:inherit}
.sms-actions{display:flex;gap:6px;margin-left:auto}
.sms-iconbtn{width:32px;height:32px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary,#5f6672);display:grid;place-items:center;cursor:pointer}
.sms-iconbtn:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.05))}
.sms-body{flex:1;min-height:0;display:flex;gap:16px;padding:16px 22px 20px}
.sms-side{flex:0 0 336px;width:336px;display:flex;flex-direction:column;gap:12px;overflow:auto}
.sms-card{background:var(--dsw-alias-bg-module,#fff);border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.08));border-radius:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.sms-nav{padding:7px}
.sms-navitem{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;cursor:pointer;color:var(--dsw-alias-label-secondary,#5f6672);user-select:none}
.sms-navitem:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.045));color:var(--dsw-alias-label-primary,#1f2329)}
.sms-navitem.active{background:rgba(59,108,246,.1);color:#3b6cf6;font-weight:600}
.sms-navitem.drop{outline:2px dashed #3b6cf6;outline-offset:-2px;background:rgba(59,108,246,.06)}
.sms-label{flex:1;min-width:0;line-height:1.35;word-break:break-word}
.sms-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-variant-numeric:tabular-nums;min-width:14px;text-align:right}
.sms-section{padding:11px 13px;border-top:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.06))}
.sms-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.sms-kicker{font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.sms-addbtn{border:0;background:transparent;color:#3b6cf6;font:inherit;font-size:11.5px;cursor:pointer;padding:2px 4px;border-radius:6px}
.sms-addbtn:hover{background:rgba(59,108,246,.1)}
.sms-group{display:flex;align-items:center;gap:6px;padding:8px 9px;border-radius:9px;cursor:pointer;user-select:none}
.sms-group:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.045))}
.sms-group.active{background:rgba(59,108,246,.1)}
.sms-group.drop{outline:2px dashed #3b6cf6;outline-offset:-2px;background:rgba(59,108,246,.07)}
.sms-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:#22a06b}
.sms-dot.off{background:#c2c6cc}
.sms-tools{display:flex;gap:2px;opacity:0;transition:opacity .1s}
.sms-group:hover .sms-tools{opacity:1}
.sms-mini{width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a9099);display:grid;place-items:center;cursor:pointer}
.sms-mini:hover{background:rgba(0,0,0,.07);color:var(--dsw-alias-label-primary,#1f2329)}
.sms-mini.danger:hover{background:rgba(220,60,60,.12);color:#d33}.sms-mini.armed{background:rgba(220,60,60,.16);color:#d33}
.sms-rename{width:100%;border:1px solid #3b6cf6;border-radius:7px;padding:3px 6px;font:inherit;outline:0;background:var(--dsw-alias-bg-module,#fff);color:inherit}
.sms-newgroup{display:flex;gap:6px;margin-top:5px}
.sms-newgroup input{flex:1;min-width:0;border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.12));border-radius:8px;padding:6px 9px;font:inherit;outline:0;background:var(--dsw-alias-bg-module,#fff);color:inherit}
.sms-btn{border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.12));background:var(--dsw-alias-bg-module,#fff);color:var(--dsw-alias-label-primary,#1f2329);border-radius:8px;padding:6px 11px;font:inherit;cursor:pointer;white-space:nowrap}
.sms-btn:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.045))}
.sms-btn.primary{background:#3b6cf6;border-color:transparent;color:#fff}
.sms-btn.danger{color:#d33;border-color:rgba(220,60,60,.3)}
.sms-btn:disabled{opacity:.5;cursor:not-allowed}
.sms-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-module,#fff);border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.08));border-radius:14px}
.sms-toolbar{display:flex;align-items:center;gap:10px;padding:12px 16px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.06))}
.sms-toolbar-title{font-weight:660;font-size:13.5px}
.sms-spacer{flex:1}
.sms-content{flex:1;min-height:0;overflow:auto}
.sms-row{display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.05))}
.sms-row:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.028))}
.sms-row.selected{background:rgba(59,108,246,.07)}
.sms-row.dragging{opacity:.45}
.sms-check{width:15px;height:15px;accent-color:#3b6cf6;cursor:pointer}
.sms-grip{color:#c2c6cc;cursor:grab;display:flex}
.sms-body-col{flex:1;min-width:0}
.sms-row-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sms-name{font-weight:640;font-size:12.8px}
.sms-desc{color:var(--dsw-alias-label-secondary,#6b7280);font-size:11.6px;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sms-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
.sms-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;font-size:10.5px;background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.05));color:var(--dsw-alias-label-secondary,#6b7280);cursor:pointer}
.sms-chip.on{background:rgba(34,160,107,.12);color:#1d8a5c}
.sms-badge{display:inline-flex;padding:0 6px;border-radius:5px;font-size:10px;line-height:17px;font-weight:600}
.sms-badge.ok{background:rgba(34,160,107,.13);color:#1d8a5c}
.sms-badge.warn{background:rgba(210,140,20,.14);color:#9a6b00}
.sms-badge.muted{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.06));color:var(--dsw-alias-label-tertiary,#8a9099)}
.sms-badge.info{background:rgba(59,108,246,.12);color:#2f57c9}
.sms-switch{position:relative;width:34px;height:19px;flex:0 0 auto;border:0;border-radius:999px;padding:0;cursor:pointer;background:var(--dsw-alias-line-strong,rgba(0,0,0,.18));transition:background .14s}
.sms-switch.on{background:#3b6cf6}
.sms-switch.disabled{opacity:.45;cursor:not-allowed}
.sms-knob{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .14s}
.sms-switch.on .sms-knob{transform:translateX(15px)}
.sms-empty{padding:54px 24px;text-align:center;color:var(--dsw-alias-label-tertiary,#8a9099)}
.sms-empty-icon{width:46px;height:46px;margin:0 auto 12px;border-radius:14px;display:grid;place-items:center;background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.04))}
.sms-empty-title{font-weight:600;color:var(--dsw-alias-label-secondary,#6b7280);margin-bottom:4px}
.sms-overview{padding:16px;display:flex;flex-direction:column;gap:14px}
.sms-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.sms-stat{padding:14px;border-radius:12px;background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.028));border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.05))}
.sms-stat-n{font-size:23px;font-weight:700;font-variant-numeric:tabular-nums}
.sms-stat-l{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8a9099)}
.sms-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sms-panel{padding:14px;border-radius:12px;border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.06))}
.sms-panel-title{font-weight:650;margin-bottom:10px;display:flex;align-items:center;gap:7px}
.sms-kv{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px}
.sms-muted{color:var(--dsw-alias-label-tertiary,#8a9099);font-size:11.5px}
.sms-drop{padding:22px;border-radius:12px;border:2px dashed var(--dsw-alias-line-strong,rgba(0,0,0,.16));text-align:center;color:var(--dsw-alias-label-tertiary,#8a9099)}
.sms-drop.over{border-color:#3b6cf6;background:rgba(59,108,246,.06);color:#2f57c9}
.sms-form{display:grid;gap:9px;padding:14px;border-top:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.06));background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.02))}
.sms-field{display:grid;gap:4px}
.sms-field label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a9099)}
.sms-field input,.sms-field select,.sms-field textarea{border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.14));border-radius:8px;padding:7px 9px;font:inherit;outline:0;background:var(--dsw-alias-bg-module,#fff);color:inherit}
.sms-field textarea{min-height:56px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:11.5px}
.sms-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483001;padding:9px 16px;border-radius:10px;font-size:12.5px;color:#fff;background:#1f2329;box-shadow:0 8px 28px rgba(0,0,0,.22)}
.sms-toast.error{background:#b3261e}
.sms-progress{position:absolute;left:0;right:0;top:0;height:2px;background:#3b6cf6;animation:sms-progress 1.1s ease-in-out infinite;transform-origin:0 50%}
@keyframes sms-progress{0%{transform:scaleX(.05)}50%{transform:scaleX(.7)}100%{transform:scaleX(.05)}}
.sms-launch{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.12));background:var(--dsw-alias-bg-module,#fff);color:var(--dsw-alias-label-secondary,#5f6672);font:inherit;font-size:11.5px;cursor:pointer}
.sms-row-toggle{margin-left:auto;display:flex;align-items:center;padding-left:8px}.sms-launch:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#1f2329)}
`;

    const cx = (...parts) => parts.filter(Boolean).join(' ');
    const memberships = (name, groups) => groups.filter((group) => group.skills.includes(name));
    const visibleIn = (name, groups) => groups.some((group) => group.enabled && group.skills.includes(name));
    const hit = (text, query) => query === '' || String(text).toLowerCase().includes(query);

    const Toggle = (props) => h('button', {
      type: 'button', role: 'switch', 'aria-checked': props.checked, title: props.title,
      className: cx('sms-switch', props.checked && 'on', props.disabled && 'disabled'),
      onClick: (event) => { event.stopPropagation(); if (!props.disabled) props.onChange(!props.checked); },
    }, h('span', { className: 'sms-knob' }));

    const Badge = (props) => h('span', { className: cx('sms-badge', props.tone) }, props.children);

    function Confirm(props) {
      const [armed, setArmed] = useState(false);
      useEffect(() => {
        if (!armed) return undefined;
        const timer = setTimeout(() => setArmed(false), 3000);
        return () => clearTimeout(timer);
      }, [armed]);
      return h('button', {
        type: 'button', title: props.title, className: cx(props.className, armed && 'danger'),
        onClick: (event) => {
          event.stopPropagation();
          if (!armed) { setArmed(true); return; }
          setArmed(false);
          props.onConfirm();
        },
      }, armed ? (props.confirmLabel || '再点一次确认') : props.label);
    }

    const Empty = (props) => h('div', { className: 'sms-empty' },
      h('div', { className: 'sms-empty-icon' }, h(Icon, { name: props.icon, size: 22 })),
      h('div', { className: 'sms-empty-title' }, props.title),
      props.hint ? h('div', { className: 'sms-muted' }, props.hint) : null);

    function SkillRow(props) {
      const chips = memberships(props.skill.name, props.groups);
      const enabled = props.enabledNames ? props.enabledNames.has(props.skill.name) : visibleIn(props.skill.name, props.groups);
      const rows = chips.map((group) => h('span', {
        key: group.id, className: cx('sms-chip', group.enabled && 'on'),
        title: group.enabled ? '所在分组已启用' : '所在分组已停用',
        onClick: (event) => { event.stopPropagation(); props.onOpenGroup(group.id); },
      }, h('span', { className: cx('sms-dot', !group.enabled && 'off') }), group.name));
      return h('div', {
        className: cx('sms-row', props.selected && 'selected', props.dragging && 'dragging'),
        draggable: true,
        onDragStart: (event) => {
          event.dataTransfer.setData('text/plain', props.skill.name);
          event.dataTransfer.effectAllowed = 'copy';
          props.onDragStart(props.skill.name);
        },
        onDragEnd: props.onDragEnd,
      },
        h('input', {
          type: 'checkbox', className: 'sms-check', checked: props.selected,
          'aria-label': '选择 ' + props.skill.name,
          onChange: () => props.onSelect(props.skill.name),
        }),
        h('span', { className: 'sms-grip' }, h(Icon, { name: 'grip', size: 14 })),
        h('div', { className: 'sms-body-col' },
          h('div', { className: 'sms-row-top' },
            h('span', { className: 'sms-name' }, props.skill.name),
            enabled ? h(Badge, { tone: 'ok' }, '可自动调用') : h(Badge, { tone: 'muted' }, '仅手动'),
            chips.length === 0 ? h(Badge, { tone: 'warn' }, '未分组') : null),
          props.skill.description ? h('div', { className: 'sms-desc' }, props.skill.description) : null,
          chips.length === 0 ? null : h('div', { className: 'sms-chips' }, rows)),
        h('span', { className: 'sms-row-toggle' },
          h(Toggle, {
            checked: enabled,
            disabled: props.busy,
            title: enabled ? '关闭（模型不可自动调用）' : '开启（模型可自动调用）',
            onChange: () => props.onToggle(props.skill.name),
          })));
    }

    function GroupItem(props) {
      const [renaming, setRenaming] = useState(false);
      const [armDelete, setArmDelete] = useState(false);
      const [draft, setDraft] = useState(props.group.name);
      const inputRef = useRef(null);
      useEffect(() => {
        if (!armDelete) return undefined;
        const timer = setTimeout(() => setArmDelete(false), 3000);
        return () => clearTimeout(timer);
      }, [armDelete]);
      useEffect(() => {
        if (!renaming) return undefined;
        setDraft(props.group.name);
        const timer = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 20);
        return () => clearTimeout(timer);
      }, [renaming, props.group.name]);
      const commit = () => {
        const next = draft.trim();
        setRenaming(false);
        if (next && next !== props.group.name) props.onRename(props.group.id, next);
      };
      return h('div', {
        className: cx('sms-group', props.active && 'active', props.drop && 'drop'),
        onClick: () => props.onOpen(props.group.id),
        onDragOver: (event) => { event.preventDefault(); props.onDragOverGroup(props.group.id); },
        onDragLeave: () => props.onDragLeaveGroup(),
        onDrop: (event) => { event.preventDefault(); props.onDropSkill(props.group.id, event.dataTransfer.getData('text/plain')); },
      },
        h('span', { className: cx('sms-dot', !props.group.enabled && 'off') }),
        renaming
          ? h('input', {
              ref: inputRef, className: 'sms-rename', value: draft,
              onClick: (event) => event.stopPropagation(),
              onChange: (event) => setDraft(event.target.value),
              onBlur: commit,
              onKeyDown: (event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') setRenaming(false); },
            })
          : h('span', { className: 'sms-label', title: props.group.name }, props.group.name),
        h('span', { className: 'sms-count' }, String(props.group.skills.length)),
        h('div', { className: 'sms-tools', onClick: (event) => event.stopPropagation() },
          h('button', { type: 'button', className: 'sms-mini', title: '重命名', onClick: () => setRenaming(true) }, h(Icon, { name: 'edit', size: 12 })),
          h('button', {
            type: 'button',
            className: cx('sms-mini danger', armDelete && 'armed'),
            title: armDelete ? '再点一次确认删除' : '删除分组',
            onClick: (event) => {
              event.stopPropagation();
              if (!armDelete) { setArmDelete(true); return; }
              setArmDelete(false);
              props.onDelete(props.group.id);
            },
          }, h(Icon, { name: 'trash', size: 12 }))),
        h(Toggle, { checked: props.group.enabled, disabled: props.busy, title: '启用/停用', onChange: (value) => props.onToggle(props.group.id, value) }));
    }

    function Overview(props) {
      const groups = props.groups;
      const groupRows = groups.length === 0
        ? h('div', { className: 'sms-muted' }, '还没有分组。先在左侧新建一个，再把 skill 拖进去。')
        : groups.map((group) => h('div', { key: group.id, className: 'sms-kv' },
            h('span', { className: cx('sms-dot', !group.enabled && 'off') }),
            h('span', { style: { flex: 1, cursor: 'pointer' }, onClick: () => props.onOpenGroup(group.id) }, group.name),
            h('span', { className: 'sms-muted' }, group.skills.length + ' 项'),
            h(Toggle, { checked: group.enabled, disabled: props.busy, onChange: () => props.onAllGroups(group.id, !group.enabled) })));
      const ungrouped = props.ungrouped.length === 0
        ? h('div', { className: 'sms-muted' }, '所有 skill 都已在某个分组里。')
        : h('div', null,
            props.ungrouped.slice(0, 8).map((skill) => h('div', { key: skill.name, className: 'sms-kv' }, h('span', { className: 'sms-chip' }, skill.name))),
            h('div', { className: 'sms-muted', style: { marginTop: 8, cursor: 'pointer' }, onClick: props.onOpenUngrouped }, '查看全部 ' + props.ungrouped.length + ' 项 →'));
      return h('div', { className: 'sms-overview' },
        h('div', { className: 'sms-stats' },
          h('div', { className: 'sms-stat' }, h('div', { className: 'sms-stat-n' }, String(props.skills.length)), h('div', { className: 'sms-stat-l' }, 'Skills 总数')),
          h('div', { className: 'sms-stat' }, h('div', { className: 'sms-stat-n' }, String(props.enabledNames.size)), h('div', { className: 'sms-stat-l' }, '可自动调用')),
          h('div', { className: 'sms-stat' }, h('div', { className: 'sms-stat-n' }, groups.filter((g) => g.enabled).length + ' / ' + groups.length), h('div', { className: 'sms-stat-l' }, '启用分组')),
          h('div', { className: 'sms-stat' }, h('div', { className: 'sms-stat-n' }, props.servers.filter((s) => s.live).length + ' / ' + props.servers.length), h('div', { className: 'sms-stat-l' }, 'MCP 在线'))),
        h('div', { className: 'sms-grid2' },
          h('div', { className: 'sms-panel' },
            h('div', { className: 'sms-panel-title' }, h(Icon, { name: 'layers', size: 15 }), '分组状态'),
            groupRows,
            groups.length === 0 ? null : h('div', { style: { display: 'flex', gap: 8, marginTop: 10 } },
              h('button', { type: 'button', className: 'sms-btn', disabled: props.busy, onClick: () => props.onAllGroups(null, true) }, '全部启用'),
              h('button', { type: 'button', className: 'sms-btn', disabled: props.busy, onClick: () => props.onAllGroups(null, false) }, '全部停用'))),
          h('div', { className: 'sms-panel' },
            h('div', { className: 'sms-panel-title' }, h(Icon, { name: 'warn', size: 15 }), '未分组 Skills'),
            ungrouped)),
        h('div', { className: 'sms-panel' },
          h('div', { className: 'sms-panel-title' }, h(Icon, { name: 'bolt', size: 15 }), '怎么用'),
          h('div', { className: 'sms-muted' }, '① 分组开关决定模型能否自动调用组内 skill。② 把 skill 行拖到左侧分组即可加入，拖到「未分组」= 移出所有分组。③ 多选后批量加入/移出。④ 顶部搜索同时过滤 skill 与 MCP。')));
    }

    function SkillsView(props) {
      const allSelected = props.skills.length > 0 && props.skills.every((skill) => props.selected.has(skill.name));
      const bulk = props.selected.size === 0 ? null : h(react.Fragment, null,
        h('select', {
          className: 'sms-btn', value: '',
          onChange: (event) => { if (event.target.value) props.onBulkAdd(event.target.value, [...props.selected]); },
        }, h('option', { value: '' }, '加入分组…'), props.groups.map((group) => h('option', { key: group.id, value: group.id }, group.name))),
        h(Confirm, { className: 'sms-btn danger', label: '移出所有分组', confirmLabel: '确认移出？', onConfirm: props.onBulkRemoveAll }),
        h('span', { className: 'sms-muted' }, '已选 ' + props.selected.size));
      return h(react.Fragment, null,
        h('div', { className: 'sms-toolbar' },
          h('span', { className: 'sms-toolbar-title' }, props.title),
          h('span', { className: 'sms-muted' }, props.subtitle),
          h('div', { className: 'sms-spacer' }),
          h('button', { type: 'button', className: 'sms-btn', onClick: allSelected ? props.onClear : props.onSelectAll }, allSelected ? '取消全选' : '全选'),
          bulk),
        h('div', { className: 'sms-content' },
          props.skills.length === 0
            ? h(Empty, { icon: 'search', title: '没有匹配的 skill', hint: props.query ? '换个关键词' : '当前视图为空' })
            : props.skills.map((skill) => h(SkillRow, {
                key: skill.name, skill: skill, groups: props.groups,
                selected: props.selected.has(skill.name), dragging: props.dragging === skill.name,
                onSelect: props.onSelect, onOpenGroup: props.onOpenGroup, busy: props.busy, onToggle: props.onToggle, enabledNames: props.enabledNames,
                onDragStart: props.onDragStart, onDragEnd: props.onDragEnd,
              }))));
    }

    function GroupView(props) {
      const [dropOver, setDropOver] = useState(false);
      const [renaming, setRenaming] = useState(false);
      const [draft, setDraft] = useState(props.group.name);
      useEffect(() => { if (renaming) setDraft(props.group.name); }, [renaming, props.group.name]);
      const commit = () => {
        const next = draft.trim();
        setRenaming(false);
        if (next && next !== props.group.name) props.onRename(props.group.id, next);
      };
      const members = props.group.skills.map((name) => props.skills.find((skill) => skill.name === name)).filter(Boolean);
      const allSelected = members.length > 0 && members.every((skill) => props.selected.has(skill.name));
      const title = renaming
        ? h('input', {
            className: 'sms-rename', style: { maxWidth: 260 }, value: draft, autoFocus: true,
            onChange: (event) => setDraft(event.target.value),
            onBlur: commit,
            onKeyDown: (event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') setRenaming(false); },
          })
        : h('span', { className: 'sms-toolbar-title' }, props.group.name);
      const rows = members.length === 0
        ? h(Empty, { icon: 'folder', title: '这个分组还是空的', hint: '从左侧「全部 Skills」拖进来' })
        : members.map((skill) => h('div', {
            key: skill.name,
            className: cx('sms-row', props.selected.has(skill.name) && 'selected', props.dragging === skill.name && 'dragging'),
            draggable: true,
            onDragStart: (event) => {
              event.dataTransfer.setData('text/plain', skill.name);
              event.dataTransfer.effectAllowed = 'copy';
              props.onDragStart(skill.name);
            },
            onDragEnd: props.onDragEnd,
          },
            h('input', { type: 'checkbox', className: 'sms-check', checked: props.selected.has(skill.name), onChange: () => props.onSelect(skill.name) }),
            h('span', { className: 'sms-grip' }, h(Icon, { name: 'grip', size: 14 })),
            h('div', { className: 'sms-body-col' },
              h('div', { className: 'sms-row-top' },
                h('span', { className: 'sms-name' }, skill.name),
                visibleIn(skill.name, [props.group]) ? h(Badge, { tone: 'ok' }, '本组可见') : h(Badge, { tone: 'muted' }, '本组停用中')),
              skill.description ? h('div', { className: 'sms-desc' }, skill.description) : null),
            h('button', { type: 'button', className: 'sms-mini danger', title: '移出本组', onClick: () => props.onRemove(props.group.id, [skill.name]) }, h(Icon, { name: 'close', size: 13 }))));
      return h(react.Fragment, null,
        h('div', { className: 'sms-toolbar' },
          title,
          h(Badge, { tone: props.group.enabled ? 'ok' : 'muted' }, props.group.enabled ? '已启用' : '已停用'),
          h('span', { className: 'sms-muted' }, members.length + ' 项'),
          h('div', { className: 'sms-spacer' }),
          h('button', { type: 'button', className: 'sms-btn', onClick: () => setRenaming(true) }, '重命名'),
          h(Confirm, { className: 'sms-btn danger', label: '删除分组', confirmLabel: '确认删除？', onConfirm: () => props.onDelete(props.group.id) }),
          h(Toggle, { checked: props.group.enabled, disabled: props.busy, onChange: (value) => props.onToggle(props.group.id, value) })),
        h('div', { className: 'sms-toolbar' },
          h('button', { type: 'button', className: 'sms-btn', onClick: allSelected ? props.onClear : props.onSelectAll }, allSelected ? '取消全选' : '全选本组'),
          props.selected.size === 0 ? null : h(Confirm, { className: 'sms-btn danger', label: '从本组移除（' + props.selected.size + '）', confirmLabel: '确认移除？', onConfirm: () => props.onRemove(props.group.id, [...props.selected]) }),
          h('div', { className: 'sms-spacer' }),
          h('button', { type: 'button', className: 'sms-btn', onClick: props.onOpenSkills }, '去 Skills 里挑 →')),
        h('div', { className: 'sms-content' },
          h('div', {
            className: cx('sms-drop', dropOver && 'over'), style: { margin: '14px 16px' },
            onDragOver: (event) => { event.preventDefault(); setDropOver(true); },
            onDragLeave: () => setDropOver(false),
            onDrop: (event) => { event.preventDefault(); setDropOver(false); props.onDropSkill(props.group.id, event.dataTransfer.getData('text/plain')); },
          }, dropOver ? '松手即加入「' + props.group.name + '」' : '把 Skills 列表里的行拖到这里，即可加入本组'),
          rows));
    }

    function McpView(props) {
      const [openForm, setOpenForm] = useState(false);
      const [form, setForm] = useState({ serverName: '', transport: 'stdio', command: '', args: '', url: '' });
      const [submitting, setSubmitting] = useState(false);
      const list = props.servers.filter((server) => hit(server.serverName + ' ' + server.source, props.query));
      const submit = async () => {
        const payload = { serverName: form.serverName.trim(), transport: form.transport };
        if (form.transport === 'stdio') {
          payload.command = form.command.trim();
          payload.args = form.args.split('\n').map((line) => line.trim()).filter(Boolean);
        } else {
          payload.url = form.url.trim();
        }
        setSubmitting(true);
        try {
          const ok = await props.onAdd(payload);
          if (ok) {
            setForm({ serverName: '', transport: 'stdio', command: '', args: '', url: '' });
            setOpenForm(false);
          }
        } finally {
          setSubmitting(false);
        }
      };
      const formBody = form.transport === 'stdio'
        ? h(react.Fragment, null,
            h('div', { className: 'sms-field' }, h('label', null, '命令'), h('input', { value: form.command, placeholder: 'node', onChange: (event) => setForm({ ...form, command: event.target.value }) })),
            h('div', { className: 'sms-field' }, h('label', null, '参数（每行一个）'), h('textarea', { value: form.args, onChange: (event) => setForm({ ...form, args: event.target.value }) })))
        : h('div', { className: 'sms-field' }, h('label', null, 'URL'), h('input', { value: form.url, placeholder: 'http://127.0.0.1:9998/mcp', onChange: (event) => setForm({ ...form, url: event.target.value }) }));
      const rows = list.length === 0
        ? h(Empty, { icon: 'plug', title: '没有匹配的 MCP', hint: props.query ? '换个关键词' : '还没有配置任何 MCP' })
        : list.map((server) => h('div', { key: server.serverName, className: 'sms-row' },
            h('span', { className: cx('sms-dot', !server.live && 'off') }),
            h('div', { className: 'sms-body-col' },
              h('div', { className: 'sms-row-top' },
                h('span', { className: 'sms-name' }, server.serverName),
                h(Badge, { tone: server.source === 'user' ? 'info' : 'muted' }, server.source === 'user' ? '用户添加' : 'profile 配置'),
                h(Badge, { tone: server.live ? 'ok' : 'warn' }, server.live ? '在线' : '离线'),
                h(Badge, { tone: 'muted' }, server.toolCount + ' tools')),
              h('div', { className: 'sms-muted' }, server.source === 'user' ? '停用后工具会从模型目录移除；可删除。' : 'profile 配置的 MCP 只能停用。')),
            h(Toggle, { checked: server.enabled, disabled: props.busy, onChange: (value) => props.onToggle(server.serverName, value) }),
            server.source === 'user' ? h(Confirm, { className: 'sms-btn danger', label: '删除', confirmLabel: '确认删除？', onConfirm: () => props.onRemove(server.serverName) }) : null));
      return h(react.Fragment, null,
        h('div', { className: 'sms-toolbar' },
          h('span', { className: 'sms-toolbar-title' }, 'MCP 服务器'),
          h('span', { className: 'sms-muted' }, props.servers.filter((s) => s.live).length + ' / ' + props.servers.length + ' 在线'),
          h('div', { className: 'sms-spacer' }),
          h('button', { type: 'button', className: 'sms-btn primary', onClick: () => setOpenForm(!openForm) }, openForm ? '收起' : '添加 MCP')),
        openForm ? h('div', { className: 'sms-form' },
          h('div', { className: 'sms-field' }, h('label', null, '名称'), h('input', { value: form.serverName, placeholder: 'my-server', onChange: (event) => setForm({ ...form, serverName: event.target.value }) })),
          h('div', { className: 'sms-field' }, h('label', null, '传输方式'),
            h('select', { value: form.transport, onChange: (event) => setForm({ ...form, transport: event.target.value }) },
              h('option', { value: 'stdio' }, 'stdio'),
              h('option', { value: 'streamable-http' }, 'streamable-http'))),
          formBody,
          h('div', { style: { display: 'flex', gap: 8 } },
            h('button', { type: 'button', className: 'sms-btn primary', disabled: submitting || props.busy, onClick: submit }, submitting ? '添加中…' : '添加并启用'),
            h('button', { type: 'button', className: 'sms-btn', onClick: () => setOpenForm(false) }, '取消'))) : null,
        h('div', { className: 'sms-content' }, rows));
    }

    function Studio() {
      const open = useOpen();
      const [data, setData] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [view, setView] = useState({ kind: 'skills' });
      const [query, setQuery] = useState('');
      const [selected, setSelected] = useState([]);
      const [dragging, setDragging] = useState('');
      const [dropGroup, setDropGroup] = useState('');
      const [overUngrouped, setOverUngrouped] = useState(false);
      const [toast, setToast] = useState(null);
      const [creating, setCreating] = useState(false);
      const [draftName, setDraftName] = useState('');
      const [maximized, setMaximized] = useState(false);
      const [minimized, setMinimized] = useState(false);
      const searchRef = useRef(null);
      const toastTimer = useRef(null);

      const notify = useCallback((message, tone) => {
        setToast({ message: message, tone: tone || 'ok' });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2600);
      }, []);

      const reload = useCallback(async () => {
        try {
          const values = await Promise.all([rpc('studio.state.get'), rpc('studio.skills.list'), rpc('studio.mcp.list')]);
          setData({
            groups: (values[0] && values[0].groups) || [],
            skills: (values[1] && values[1].skills) || [],
            servers: (values[2] && values[2].servers) || [],
          });
          setError('');
        } catch (cause) {
          setData(null);
          setError(String((cause && cause.message) || cause));
        }
      }, []);

      const run = useCallback(async (label, task) => {
        setBusy(true);
        try {
          await task();
          await reload();
          notify(label);
          return true;
        } catch (cause) {
          notify('操作失败：' + String((cause && cause.message) || cause), 'error');
          return false;
        } finally {
          setBusy(false);
        }
      }, [reload, notify]);

      useEffect(() => {
        if (!open) return undefined;
        setView({ kind: 'skills' });
        setSelected([]);
        setQuery('');
        setMinimized(false);
        setBusy(true);
        reload().finally(() => setBusy(false));
        const timer = setTimeout(() => { if (searchRef.current) searchRef.current.focus(); }, 80);
        return () => clearTimeout(timer);
      }, [open, reload]);

      useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); } };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [open]);

      const groups = (data && data.groups) || [];
      const skills = (data && data.skills) || [];
      const servers = (data && data.servers) || [];
      const q = query.trim().toLowerCase();
      const visibleGroups = useMemo(() => groups.filter((group) => group.name !== DIRECT_GROUP), [groups]);

      const enabledNames = useMemo(() => {
        const names = new Set();
        groups.forEach((group) => { if (group.enabled) group.skills.forEach((name) => names.add(name)); });
        return names;
      }, [groups]);
      const ungrouped = useMemo(() => skills.filter((skill) => !groups.some((group) => group.skills.includes(skill.name))), [skills, groups]);
      const selectedSet = useMemo(() => new Set(selected), [selected]);
      const filteredAll = useMemo(() => skills.filter((skill) => hit(skill.name + ' ' + skill.description, q)), [skills, q]);
      const filteredUngrouped = useMemo(() => ungrouped.filter((skill) => hit(skill.name + ' ' + skill.description, q)), [ungrouped, q]);
      const currentGroup = view.kind === 'group' ? groups.find((group) => group.id === view.id) : null;
      const groupMembers = useMemo(() => {
        if (!currentGroup) return [];
        return currentGroup.skills.map((name) => skills.find((skill) => skill.name === name)).filter(Boolean).filter((skill) => hit(skill.name + ' ' + skill.description, q));
      }, [currentGroup, skills, q]);

      if (!open) return null;
      if (minimized) {
        return h('div', {
          className: 'sms-pill', title: '恢复 dsh-skill&mcp-butler',
          onClick: () => setMinimized(false),
        }, h(Icon, { name: 'layers', size: 14 }), h('span', null, 'dsh-skill&mcp-butler'), h(Icon, { name: 'restore', size: 12 }));
      }

      const toggleSelected = (name) => setSelected((previous) => (previous.includes(name) ? previous.filter((item) => item !== name) : [...previous, name]));
      const selectAll = (list) => setSelected(list.map((skill) => skill.name));

      const addSkills = (groupId, names) => {
        if (!groupId || !names || names.length === 0) return;
        const group = groups.find((item) => item.id === groupId);
        void run('已加入「' + (group ? group.name : groupId) + '」', () => rpc('studio.groups.addSkill', { id: groupId, skills: names }))
          .then((ok) => { if (ok) setSelected([]); });
      };
      const removeSkills = (groupId, names) => {
        if (!groupId || !names || names.length === 0) return;
        void run('已从分组移除 ' + names.length + ' 项', () => rpc('studio.groups.removeSkill', { id: groupId, skills: names }))
          .then((ok) => { if (ok) setSelected([]); });
      };
      const removeEverywhere = () => {
        const names = [...selectedSet];
        if (names.length === 0) return;
        void run('已移出所有分组', async () => {
          for (const group of groups) {
            const hits = group.skills.filter((name) => names.includes(name));
            if (hits.length > 0) await rpc('studio.groups.removeSkill', { id: group.id, skills: hits });
          }
        }).then((ok) => { if (ok) setSelected([]); });
      };
      // Per-skill switch: on = put it in the hidden "单独启用" group (always
      // enabled); off = remove it from every group so it stops being visible.
      const ensureDirectGroup = async () => {
        const found = groups.find((group) => group.name === DIRECT_GROUP);
        if (found !== undefined) {
          if (!found.enabled) await rpc('studio.groups.setEnabled', { id: found.id, enabled: true });
          return found.id;
        }
        const created = await rpc('studio.groups.create', { name: DIRECT_GROUP });
        await rpc('studio.groups.setEnabled', { id: created.id, enabled: true });
        return created.id;
      };
      const toggleSkill = (name) => {
        if (enabledNames.has(name)) {
          void run('已关闭 ' + name, async () => {
            for (const group of groups) {
              if (group.skills.includes(name)) await rpc('studio.groups.removeSkill', { id: group.id, skills: [name] });
            }
          });
          return;
        }
        void run('已开启 ' + name, async () => {
          const id = await ensureDirectGroup();
          await rpc('studio.groups.addSkill', { id, skills: [name] });
        });
      };
      const toggleGroup = (id, enabled) => { void run(enabled ? '分组已启用' : '分组已停用', () => rpc('studio.groups.setEnabled', { id: id, enabled: enabled })); };
      const toggleAllGroups = (id, enabled) => {
        void run(enabled ? '已全部启用' : '已全部停用', async () => {
          const targets = id ? groups.filter((group) => group.id === id) : groups;
          for (const group of targets) {
            if (group.enabled !== enabled) await rpc('studio.groups.setEnabled', { id: group.id, enabled: enabled });
          }
        });
      };
      const renameGroup = (id, name) => { void run('分组已重命名', () => rpc('studio.groups.rename', { id: id, name: name })); };
      const deleteGroup = (id) => {
        void run('分组已删除', () => rpc('studio.groups.delete', { id: id })).then((ok) => {
          if (ok && view.kind === 'group' && view.id === id) setView({ kind: 'overview' });
        });
      };
      const createGroup = () => {
        const name = draftName.trim();
        if (!name) return;
        void run('已新建分组', () => rpc('studio.groups.create', { name: name })).then((ok) => {
          if (ok) { setDraftName(''); setCreating(false); }
        });
      };
      const mcpToggle = (serverName, enabled) => { void run(serverName + (enabled ? ' 已启用' : ' 已停用'), () => rpc('studio.mcp.toggle', { serverName: serverName, enabled: enabled })); };
      const mcpRemove = (serverName) => { void run('已删除 MCP ' + serverName, () => rpc('studio.mcp.remove', { serverName: serverName })); };
      const mcpAdd = async (payload) => {
        setBusy(true);
        try {
          await rpc('studio.mcp.add', payload);
          await reload();
          notify('已添加 MCP ' + payload.serverName);
          return true;
        } catch (cause) {
          notify('添加失败：' + String((cause && cause.message) || cause), 'error');
          return false;
        } finally {
          setBusy(false);
        }
      };

      const navItem = (kind, icon, label, count, extra) => h('div', {
        className: cx('sms-navitem', view.kind === kind && 'active', extra && extra.cls),
        onClick: () => { setView({ kind: kind }); setSelected([]); },
        onDragOver: extra && extra.onDragOver,
        onDragLeave: extra && extra.onDragLeave,
        onDrop: extra && extra.onDrop,
      }, h(Icon, { name: icon, size: 15 }), h('span', { className: 'sms-label' }, label), count === undefined ? null : h('span', { className: 'sms-count' }, String(count)));

      const body = () => {
        if (error) return h('div', { className: 'sms-main' }, h(Empty, { icon: 'warn', title: '无法读取插件状态', hint: error }));
        if (!data) return h('div', { className: 'sms-main' }, h(Empty, { icon: 'box', title: '正在读取…' }));
        if (view.kind === 'skills') return h('div', { className: 'sms-main' }, h(SkillsView, {
          title: '全部 Skills', subtitle: filteredAll.length + ' / ' + skills.length, skills: filteredAll, groups: visibleGroups,
          selected: selectedSet, dragging: dragging, query: q, busy: busy, onToggle: toggleSkill, enabledNames: enabledNames,
          onSelect: toggleSelected, onSelectAll: () => selectAll(filteredAll), onClear: () => setSelected([]),
          onOpenGroup: (id) => { setView({ kind: 'group', id: id }); setSelected([]); },
          onDragStart: setDragging, onDragEnd: () => setDragging(''),
          onBulkAdd: addSkills, onBulkRemoveAll: removeEverywhere,
        }));
        if (view.kind === 'ungrouped') return h('div', { className: 'sms-main' }, h(SkillsView, {
          title: '未分组 Skills', subtitle: filteredUngrouped.length + ' 项（不会自动调用）', skills: filteredUngrouped, groups: visibleGroups,
          selected: selectedSet, dragging: dragging, query: q, busy: busy, onToggle: toggleSkill, enabledNames: enabledNames,
          onSelect: toggleSelected, onSelectAll: () => selectAll(filteredUngrouped), onClear: () => setSelected([]),
          onOpenGroup: (id) => { setView({ kind: 'group', id: id }); setSelected([]); },
          onDragStart: setDragging, onDragEnd: () => setDragging(''),
          onBulkAdd: addSkills, onBulkRemoveAll: removeEverywhere,
        }));
        if (view.kind === 'group' && currentGroup) return h('div', { className: 'sms-main' }, h(GroupView, {
          group: currentGroup, skills: skills, selected: selectedSet, dragging: dragging,
          onOpenSkills: () => { setView({ kind: 'skills' }); setSelected([]); },
          onToggle: toggleGroup, onRename: renameGroup, onDelete: deleteGroup,
          onRemove: removeSkills, onDropSkill: (id, name) => addSkills(id, name ? [name] : []),
          onSelect: toggleSelected, onSelectAll: () => selectAll(groupMembers), onClear: () => setSelected([]),
          onDragStart: setDragging, onDragEnd: () => setDragging(''), busy: busy,
        }));
        if (view.kind === 'mcp') return h('div', { className: 'sms-main' }, h(McpView, { servers: servers, query: q, busy: busy, onToggle: mcpToggle, onRemove: mcpRemove, onAdd: mcpAdd }));
        return h('div', { className: 'sms-main' }, h(Overview, {
          groups: visibleGroups, skills: skills, servers: servers, enabledNames: enabledNames, ungrouped: ungrouped,
          onOpenGroup: (id) => { setView({ kind: 'group', id: id }); setSelected([]); },
          onOpenUngrouped: () => { setView({ kind: 'ungrouped' }); setSelected([]); },
          onAllGroups: toggleAllGroups, busy: busy,
        }));
      };

      const ungroupedDrop = {
        cls: overUngrouped ? 'drop' : '',
        onDragOver: (event) => { event.preventDefault(); setOverUngrouped(true); },
        onDragLeave: () => setOverUngrouped(false),
        onDrop: (event) => {
          event.preventDefault();
          setOverUngrouped(false);
          const name = event.dataTransfer.getData('text/plain');
          setDragging('');
          if (!name) return;
          void run('已移出所有分组', async () => {
            for (const group of groups) {
              if (group.skills.includes(name)) await rpc('studio.groups.removeSkill', { id: group.id, skills: [name] });
            }
          });
        },
      };

      return h('div', { className: 'sms-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'dsh-skill&mcp-butler' },
        h('div', { className: cx('sms-window', maximized && 'max') },
          busy ? h('div', { className: 'sms-progress' }) : null,
          h('div', { className: 'sms-head' },
            h('div', { className: 'sms-brand' },
              h('span', { className: 'sms-logo' }, h(Icon, { name: 'layers', size: 16 })),
              h('div', null,
                h('div', { className: 'sms-title' }, 'dsh-skill&mcp-butler'),
                h('div', { className: 'sms-sub' }, 'Skills & MCP 管理 · ' + skills.length + ' skills · ' + visibleGroups.length + ' 组 · ' + servers.length + ' MCP'))),
            h('div', { className: 'sms-search' },
              h(Icon, { name: 'search', size: 15 }),
              h('input', { ref: searchRef, value: query, placeholder: '搜索 skill / 描述 / MCP…', onChange: (event) => setQuery(event.target.value) })),
            h('div', { className: 'sms-actions' },
              h('button', { type: 'button', className: 'sms-iconbtn', title: '刷新', onClick: () => { setBusy(true); reload().finally(() => setBusy(false)); } }, h(Icon, { name: 'refresh' })),
              h('button', { type: 'button', className: 'sms-winbtn', title: '最小化', onClick: () => setMinimized(true) }, h(Icon, { name: 'minimize' })),
              h('button', { type: 'button', className: 'sms-winbtn', title: maximized ? '还原' : '放大', onClick: () => setMaximized(!maximized) }, h(Icon, { name: maximized ? 'restore' : 'maximize' })),
              h('button', { type: 'button', className: 'sms-winbtn close', title: '关闭（Esc）', onClick: () => setOpen(false) }, h(Icon, { name: 'close' })))),
          h('div', { className: 'sms-body' },
            h('div', { className: 'sms-side' },
              h('div', { className: 'sms-card sms-nav' },
                navItem('skills', 'layers', '全部 Skills', skills.length),
                navItem('ungrouped', 'warn', '未分组', ungrouped.length, ungroupedDrop),
                navItem('mcp', 'plug', 'MCP 服务器', servers.length),
                navItem('overview', 'grid', '概览')),
              h('div', { className: 'sms-card sms-section' },
                h('div', { className: 'sms-section-head' },
                  h('span', { className: 'sms-kicker' }, '分组'),
                  h('button', { type: 'button', className: 'sms-addbtn', onClick: () => setCreating(!creating) }, creating ? '取消' : '+ 新建')),
                creating ? h('div', { className: 'sms-newgroup' },
                  h('input', { value: draftName, placeholder: '分组名', autoFocus: true, onChange: (event) => setDraftName(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') createGroup(); } }),
                  h('button', { type: 'button', className: 'sms-btn primary', onClick: createGroup }, '建')) : null,
                visibleGroups.length === 0
                  ? h('div', { className: 'sms-muted', style: { padding: '6px 4px' } }, '还没有分组（分组是可选功能）')
                  : visibleGroups.map((group) => h(GroupItem, {
                      key: group.id, group: group, active: view.kind === 'group' && view.id === group.id,
                      drop: dragging !== '' && dropGroup === group.id, busy: busy,
                      onOpen: (id) => { setView({ kind: 'group', id: id }); setSelected([]); },
                      onToggle: toggleGroup, onRename: renameGroup, onDelete: deleteGroup,
                      onDropSkill: (id, name) => { setDropGroup(''); addSkills(id, name ? [name] : []); },
                      onDragOverGroup: (id) => setDropGroup(id),
                      onDragLeaveGroup: () => setDropGroup(''),
                    })),
                h('div', { className: 'sms-muted', style: { padding: '8px 2px 0' } }, '分组是可选功能；日常直接用列表右侧开关即可。')),
              h('div', { className: 'sms-muted', style: { padding: '0 4px' } }, '拖 skill 行到分组可加入；拖到「未分组」= 移出所有分组。')),
            body())),
        toast ? h('div', { className: cx('sms-toast', toast.tone === 'error' && 'error') }, toast.message) : null);
    }

    function Launcher() {
      return h('button', { type: 'button', className: 'sms-launch', title: 'skill 整理（Ctrl+Shift+M）', onClick: () => setOpen(true) },
        h(Icon, { name: 'layers', size: 13 }), h('span', null, 'dsh-skill&mcp-butler'));
    }

    const inject = ['slots'];

    function apply(ctx) {
      ctx.effect(() => {
        if (typeof document === 'undefined') return undefined;
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-skill-mcp-studio';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => { tag.remove(); };
      }, 'skill-mcp-studio: styles');
      ctx.effect(() => {
        const onKeyDown = (event) => {
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key).toLowerCase() === 'm') {
            event.preventDefault();
            setOpen(!ui.open);
          }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, 'skill-mcp-studio: shortcut');
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'skill-mcp-studio-overlay', order: 60, label: 'dsh-skill&mcp-butler' }, Studio));
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'skill-mcp-studio-launcher', order: 9, label: 'dsh-skill&mcp-butler' }, Launcher));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
