/**
 * Icône lucide-react. Décorative par défaut (masquée aux lecteurs d'écran) ;
 * passer `label` quand l'icône est seule à porter le sens.
 *
 * Exemple : <Icon icon={Search} size={20} />
 */
export default function Icon({ icon: LucideIcon, size = 20, label, className, ...rest }) {
  return (
    <LucideIcon
      size={size}
      strokeWidth={2}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
      {...rest}
    />
  )
}
