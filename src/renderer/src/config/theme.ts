import { GlobalThemeOverrides } from 'naive-ui'

export const getThemeOverrides = (isDark: boolean): GlobalThemeOverrides => {
	// --- 动态色彩变量 ---
	const primaryColor = '#3695ff' // LinkR 品牌绿
	const primaryHover = '#56a7ff'
	const inputAccent = '#3695ff'
	const inputAccentHover = '#56a7ff'
	const inputAccentFocusRing = isDark
		? 'rgba(54, 149, 255, 0.26)'
		: 'rgba(54, 149, 255, 0.16)'

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
			primaryColorPressed: '#2f7fe7',
			borderRadius: '16px',
		},
		Form: {
			feedbackFontSizeMedium: '11px',
			feedbackHeightMedium: '20px',
		},
		Message: {
			borderRadius: '10px',
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
			borderRadius: '24px',
			color: cardBg,
			borderColor: borderColor,
			titleTextColor: textColor,
		},
		Upload: {
			borderRadius: '100%',
		},
		Input: {
			borderRadius: '8px',
			heightMedium: '38px',
			fontSizeMedium: '14px',
			color: inputBg,
			colorFocus: isDark ? '#1a1a1a' : '#ffffff',
			border: `1px solid ${borderColor}`,
			borderHover: `1px solid ${inputAccentHover}`,
			borderFocus: `1px solid ${inputAccent}`,
			boxShadowFocus: `0 0 0 4px ${inputAccentFocusRing}`,
			textColor: textColor,
			placeholderColor: placeholderColor,
			iconColor: placeholderColor,
			iconColorHover: inputAccent,
			paddingMedium: '0 16px',
		},
		Select: {
			peers: {
				InternalSelection: {
					borderRadius: '14px',
					heightMedium: '36px',
					color: inputBg,
					border: `1px solid ${borderColor}`,
					borderHover: `1px solid ${primaryHover}`,
					borderFocus: `1px solid ${primaryColor}`,
					boxShadowFocus: `0 0 0 4px ${isDark ? 'rgba(54, 149, 255, 0.2)' : 'rgba(54, 149, 255, 0.16)'}`,
					textColor: textColor,
					placeholderColor: placeholderColor,
				},
				InternalSelectMenu: {
					borderRadius: '10px',
					color: modalBg,
					optionColorActive: isDark
						? 'rgba(54, 149, 255, 0.2)'
						: 'rgba(54, 149, 255, 0.16)',
					optionTextColorActive: primaryColor,
					optionTextColor: textColor,
					actionDividerColor: isDark ? '#333' : '#f1f5f9',
				},
			},
		},
		Cascader: {
			peers: {
				InternalSelection: {
					borderRadius: '14px',
					heightMedium: '36px',
					color: inputBg,
					border: `1px solid ${borderColor}`,
					textColor: textColor,
					boxShadowFocus: `0 0 0 4px ${isDark ? 'rgba(54, 149, 255, 0.2)' : 'rgba(54, 149, 255, 0.16)'}`,
				},
				InternalSelectMenu: {
					borderRadius: '10px',
					color: modalBg,
					optionColorActive: isDark
						? 'rgba(54, 149, 255, 0.2)'
						: 'rgba(54, 149, 255, 0.16)',
					optionTextColorActive: primaryColor,
				},
			},
		},
		Button: {
			borderRadiusTiny: '12px',
			borderRadiusSmall: '12px',
			borderRadiusMedium: '14px',
			borderRadiusLarge: '16px',
			fontWeight: '600',
		},
		Dropdown: {
			borderRadius: '14px',
			color: modalBg,
			optionColorHover: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6',
			fontSizeSmall: '13px',
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
			borderRadius: '6px',
			color: modalBg,
			textColor: textColor,
		},
	}
}
