export function Skeleton({
className=""
}:{
className?:string
}){

return(

<div
className={`
animate-pulse
rounded-3xl
bg-[var(--surface-soft)]
${className}
`}
/>

);

}