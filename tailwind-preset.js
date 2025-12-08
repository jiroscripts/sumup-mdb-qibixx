/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                mono: ['"Fira Code"', '"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
                sans: ['"Fira Code"', '"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'], // Force mono everywhere
            },
            colors: {
                gray: {
                    50: '#f7f7f7',
                    100: '#e3e3e3',
                    200: '#c8c8c8',
                    300: '#a4a4a4',
                    400: '#818181',
                    500: '#666666',
                    600: '#515151',
                    700: '#434343',
                    800: '#383838',
                    900: '#0d1117', // GitHub Dark Dimmed style
                    950: '#010409', // Almost black
                },
                primary: '#2ea043', // GitHub Green
                secondary: '#8b949e',
                success: '#238636',
                danger: '#da3633',
                warning: '#d29922',
                info: '#58a6ff',
                light: '#f0f6fc',
                dark: '#0d1117',
                // Custom dev colors
                terminal: {
                    black: '#0d1117',
                    green: '#00ff00',
                    blue: '#58a6ff',
                    purple: '#bc8cff',
                }
            }
        },
    },
    plugins: [],
}
