/** Ambient module for CSS Modules: importing `*.module.css` yields a map of local class names. */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
