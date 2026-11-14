/**
 * DSH macOS widgets — Web half.
 *
 * One Settings section: bridge status (loopback endpoint, last read) and the
 * steps to add the native widget. The widget itself is a WidgetKit extension;
 * this page never renders inside it.
 */
window.__ModuleLoader__.load({
  id: 'dsh-macos-widget',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'macos-widget'
    const STATUS_PATH = '/macos-widget/api/status'

    const zh = {
      nav: 'macOS 小组件',
      title: 'macOS 小组件',
      intro: '这里选择哪个插件的小组件显示在 macOS 桌面上。小组件样式由各插件自己提供，本插件只负责基础设施。',
      'status.running': '桥接运行中',
      'status.stopped': '桥接未运行',
      'status.endpoint': '小组件数据地址',
      'status.updated': '最近读取',
      'status.never': '尚未读取',
      refresh: '刷新状态',
      'steps.title': '添加小组件',
      'widgets.title': '显示的小组件',
      'widgets.empty': '还没有插件注册 macOS 小组件',
      'widgets.current': '当前显示',
      'steps.install': '首次使用：在插件目录运行 macos/build.sh，安装 DSH 小组件宿主。',
      'steps.add': '在桌面空白处右键 → 编辑小组件 → 搜索「DSH Widgets」，添加「DSH 小组件」。',
      'steps.keep': 'DSH 需要保持运行；切换插件后小组件会在下一次刷新时更新。',
      note: '小组件是原生 WidgetKit 扩展，必须随宿主 App 签名安装；本插件只负责基础设施，样式由各插件提供。',
      'error.load': '状态读取失败',
      'error.select': '切换失败',
      'error.stale': 'Host 可能还没加载新版插件，重启 DSH 后重试。',
    }
    const en = {
      nav: 'macOS Widgets',
      title: 'macOS Widgets',
      intro: 'Choose which plugin\'s widget appears on the macOS desktop. Each plugin supplies its own widget style; this plugin is only the infrastructure.',
      'status.running': 'Bridge running',
      'status.stopped': 'Bridge stopped',
      'status.endpoint': 'Widget data endpoint',
      'status.updated': 'Last read',
      'status.never': 'Not read yet',
      refresh: 'Refresh status',
      'steps.title': 'Add the widget',
      'widgets.title': 'Shown widget',
      'widgets.empty': 'No plugin has registered a macOS widget yet',
      'widgets.current': 'Currently shown',
      'steps.install': 'First run: execute macos/build.sh in the plugin directory to install the DSH widget host.',
      'steps.add': 'Right-click the desktop → Edit Widgets → search "DSH Widgets" and add "DSH 小组件".',
      'steps.keep': 'DSH must stay running; after switching plugins the widget updates on its next refresh.',
      note: 'The widget is a native WidgetKit extension installed with its host app; this plugin is only the infrastructure, styles come from each plugin.',
      'error.load': 'Status read failed',
      'error.select': 'Switch failed',
      'error.stale': 'The Host may not have loaded the new plugin yet; restart DSH and retry.',
    }

    const CSS = `
.dsh-mw { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
.dsh-mw-title { margin: 0; font-size: 20px; line-height: 28px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dsh-mw-intro { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.dsh-mw-card { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-lg, 16px); background: var(--dsw-alias-bg-layer-1); }
.dsh-mw-row { display: flex; align-items: center; gap: 8px; }
.dsh-mw-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); }
.dsh-mw-dot.is-on { background: #2fa84f; }
.dsh-mw-state { font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dsh-mw-button { margin-left: auto; height: 28px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 14px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer; }
.dsh-mw-kv { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dsh-mw-kv code { font-family: var(--ds-font-family-code, ui-monospace, monospace); color: var(--dsw-alias-label-primary); }
.dsh-mw-error { margin: 0; font-size: 12px; color: #d93a32; }
.dsh-mw-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.dsh-mw-h3 { margin: 4px 0 0; font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dsh-mw-list { display: flex; flex-direction: column; gap: 6px; }
.dsh-mw-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-lg, 16px); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer; }
.dsh-mw-item.is-selected { border-color: var(--dsw-alias-brand-primary); }
.dsh-mw-radio { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--dsw-alias-border-l2); flex: none; }
.dsh-mw-item.is-selected .dsh-mw-radio { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); box-shadow: inset 0 0 0 2px var(--dsw-alias-bg-layer-1); }
.dsh-mw-itemText { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsh-mw-itemTitle { font-size: 13px; font-weight: 500; }
.dsh-mw-itemSub { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dsh-mw-current { margin-left: auto; font-size: 11px; color: var(--dsw-alias-brand-primary); }
.dsh-mw-empty { margin: 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-mw-note { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
`

    function MacosWidgetSection(props) {
      const t = typeof props.t === 'function' ? props.t : key => key
      const [status, setStatus] = React.useState(null)
      const [loadError, setLoadError] = React.useState(null)
      const [selectError, setSelectError] = React.useState(null)
      const [loading, setLoading] = React.useState(false)
      const [selecting, setSelecting] = React.useState(null)

      const tRef = React.useRef(t)
      tRef.current = t
      const describe = React.useCallback((reason) => {
        const message = String(reason?.message ?? reason)
        return message.includes('405') ? `${message} — ${tRef.current('error.stale')}` : message
      }, [])

      const select = React.useCallback((id) => {
        setSelecting(id)
        setSelectError(null)
        fetch('/macos-widget/api/select', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        })
          .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
          .then(value => { setStatus(value) })
          .catch(reason => { setSelectError(describe(reason)) })
          .finally(() => { setSelecting(null) })
      }, [describe])

      const load = React.useCallback(() => {
        setLoading(true)
        setLoadError(null)
        const request = (remaining) => fetch(STATUS_PATH, { headers: { accept: 'application/json' } })
          .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
          .catch(reason => {
            if (remaining > 0) return new Promise(resolve => setTimeout(resolve, 800)).then(() => request(remaining - 1))
            throw reason
          })
        request(1)
          .then(value => { setStatus(value) })
          .catch(reason => { setLoadError(describe(reason)) })
          .finally(() => { setLoading(false) })
      }, [describe])
      React.useEffect(() => { load() }, [load])

      const running = status?.listening === true
      return h('section', { className: 'dsh-mw' },
        h('style', null, CSS),
        h('h2', { className: 'dsh-mw-title' }, t('title')),
        h('p', { className: 'dsh-mw-intro' }, t('intro')),
        h('div', { className: 'dsh-mw-card' },
          h('div', { className: 'dsh-mw-row' },
            h('span', { className: `dsh-mw-dot${running ? ' is-on' : ''}` }),
            h('span', { className: 'dsh-mw-state' }, running ? t('status.running') : t('status.stopped')),
            h('button', { type: 'button', className: 'dsh-mw-button', onClick: load, disabled: loading },
              loading ? '…' : t('refresh'))),
          h('div', { className: 'dsh-mw-kv' },
            h('span', null, t('status.endpoint')),
            h('code', null, status?.endpoint ?? '—')),
          h('div', { className: 'dsh-mw-kv' },
            h('span', null, t('status.updated')),
            h('span', null, status?.lastFetchAt ?? t('status.never'))),
          loadError === null ? null : h('p', { className: 'dsh-mw-error', role: 'alert' }, `${t('error.load')}: ${loadError}`)),
        h('h3', { className: 'dsh-mw-h3' }, t('widgets.title')),
        selectError === null ? null : h('p', { className: 'dsh-mw-error', role: 'alert' }, `${t('error.select')}: ${selectError}`),
        status?.widgets?.length
          ? h('div', { className: 'dsh-mw-list', role: 'radiogroup', 'aria-label': t('widgets.title') }, status.widgets.map(widget => {
              const current = widget.id === status.selectedId
              return h('button', {
                key: widget.id,
                type: 'button',
                className: `dsh-mw-item${current ? ' is-selected' : ''}`,
                role: 'radio',
                'aria-checked': current,
                onClick: () => select(widget.id),
                disabled: selecting !== null,
              },
                h('span', { className: 'dsh-mw-radio' }),
                h('span', { className: 'dsh-mw-itemText' },
                  h('span', { className: 'dsh-mw-itemTitle' }, widget.title),
                  widget.subtitle === null ? null : h('span', { className: 'dsh-mw-itemSub' }, widget.subtitle)),
                current ? h('span', { className: 'dsh-mw-current' }, t('widgets.current')) : null)
            }))
          : h('p', { className: 'dsh-mw-empty' }, t('widgets.empty')),
        h('h3', { className: 'dsh-mw-h3' }, t('steps.title')),
        h('ol', { className: 'dsh-mw-steps' },
          h('li', null, t('steps.install')),
          h('li', null, t('steps.add')),
          h('li', null, t('steps.keep'))),
        h('p', { className: 'dsh-mw-note' }, t('note')),
      )
    }

    return {
      name: 'macos-widget-client',
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', zh), 'macos-widget: zh dictionary')
        ctx.effect(() => ctx.locale.register(NS, 'en', en), 'macos-widget: en dictionary')
        const translate = ctx.locale.bind(NS)
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'macos-widget',
          order: 50,
          locale: NS,
          label: () => translate('nav'),
        }, MacosWidgetSection))
      },
    }
  },
})
