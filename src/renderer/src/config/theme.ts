import { GlobalThemeOverrides } from 'naive-ui'

export const getThemeOverrides = (isDark: boolean): GlobalThemeOverrides => {
	// --- 动态色彩变量 ---
	const primaryColor = '#10b981' // LinkR 品牌绿
	const primaryHover = '#34d399'

	// 背景色系
	const inputBg = isDark ? '#2c2c2e' : '#f8fafc'
	const cardBg = isDark ? '#1e1e20' : '#ffffff'
	const modalBg = isDark ? '#252529' : '#ffffff'

	// 边框与文字
	const borderColor = isDark ? '#3f3f42' : '#e2e8f0'
	const textColor = isDark ? '#e5e7eb' : '#1e293b'
	const placeholderColor = isDark ? '#636366' : '#94a3b8'

	return {
		common: {
			primaryColor,
			primaryColorHover: primaryHover,
			primaryColorPressed: '#059669',
			borderRadius: '12px',
		},
		Form: {
			feedbackFontSizeMedium: '11px',
			feedbackHeightMedium: '20px',
		},
		Message: {
			borderRadius: '8px',
			// 深色模式下 Message 通常需要稍微亮一点的背景或直接跟随系统
			color: isDark ? '#333' : '#fff',
			textColor: isDark ? '#eee' : '#333',
		},
		Checkbox: {
			borderRadius: '100%',
			colorChecked: isDark ? primaryColor : '#333333',
			border: `1px solid ${borderColor}`,
			checkMarkColor: '#fff',
		},
		Card: {
			borderRadius: '18px',
			color: cardBg,
			borderColor: borderColor,
			titleTextColor: textColor,
		},
		Upload: {
			borderRadius: '100%',
		},
		Input: {
			borderRadius: '12px',
			heightMedium: '42px',
			fontSizeMedium: '14px',
			color: inputBg,
			colorFocus: isDark ? '#1a1a1a' : '#ffffff',
			border: `1px solid ${borderColor}`,
			borderHover: `1px solid ${primaryHover}`,
			borderFocus: `1px solid ${primaryColor}`,
			boxShadowFocus: `0 0 0 4px ${isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'}`,
			textColor: textColor,
			placeholderColor: placeholderColor,
			iconColor: placeholderColor,
			iconColorHover: primaryHover,
			paddingMedium: '0 16px',
		},
		Select: {
			peers: {
				InternalSelection: {
					borderRadius: '12px',
					heightMedium: '42px',
					color: inputBg,
					border: `1px solid ${borderColor}`,
					borderHover: `1px solid ${primaryHover}`,
					borderFocus: `1px solid ${primaryColor}`,
					boxShadowFocus: `0 0 0 4px ${isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'}`,
					textColor: textColor,
					placeholderColor: placeholderColor,
				},
				InternalSelectMenu: {
					borderRadius: '12px',
					color: modalBg,
					optionBorderRadius: '8px',
					optionColorActive: isDark
						? 'rgba(16, 185, 129, 0.2)'
						: 'rgba(16, 185, 129, 0.1)',
					optionTextColorActive: primaryColor,
					optionTextColor: textColor,
					actionDividerColor: isDark ? '#333' : '#f1f5f9',
				},
			},
		},
		Cascader: {
			peers: {
				InternalSelection: {
					borderRadius: '12px',
					heightMedium: '42px',
					color: inputBg,
					border: `1px solid ${borderColor}`,
					textColor: textColor,
					boxShadowFocus: `0 0 0 4px ${isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'}`,
				},
				InternalSelectMenu: {
					borderRadius: '12px',
					color: modalBg,
					optionBorderRadius: '8px',
					optionColorActive: isDark
						? 'rgba(16, 185, 129, 0.2)'
						: 'rgba(16, 185, 129, 0.1)',
					optionTextColorActive: primaryColor,
					boxShadow: isDark
						? '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
						: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
				},
			},
		},
		Button: {
			borderRadiusTiny: '10px',
			borderRadiusSmall: '10px',
			borderRadiusMedium: '12px',
			borderRadiusLarge: '14px',
			fontWeight: '600',
		},
		Dropdown: {
			borderRadius: '12px',
			color: modalBg,
			optionColorHover: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6',
		},
		Badge: {
			fontSize: '10px',
			color: '#FF0004FF',
		},
		Tabs: {
			tabBorderRadius: '8px',
			tabTextColorActiveLine: primaryColor,
			tabTextColorHoverLine: primaryHover,
			barColor: primaryColor,
		},
		Modal: {
			borderRadius: '20px',
			color: modalBg,
			textColor: textColor,
		},
	}
}
