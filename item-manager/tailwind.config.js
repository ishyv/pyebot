export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				bg: 'var(--bg)',
				'bg-elev': 'var(--bg-elev)',
				text: 'var(--text)',
				'text-soft': 'var(--text-soft)',
				muted: 'var(--muted)',
				'muted-strong': 'var(--muted-strong)',
				accent: 'var(--accent)',
				'accent-strong': 'var(--accent-strong)',
				signal: 'var(--signal)',
				'status-ok': 'var(--status-ok)',
				'status-pend': 'var(--status-pend)',
				'status-warn': 'var(--status-warn)',
				'status-fail': 'var(--status-fail)'
			},
			fontFamily: {
				body: 'var(--font-body)',
				mono: 'var(--font-mono)'
			},
			transitionTimingFunction: {
				smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
				fast: 'cubic-bezier(0.4, 0, 0.2, 1)'
			},
			boxShadow: {
				veil: 'var(--shadow-veil)'
			},
			borderRadius: {
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)'
			}
		}
	},
	plugins: []
};
