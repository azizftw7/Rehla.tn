import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import './Button.css'

/**
 * Bouton du design system.
 * - variant : primary (action principale), accent (bouton fort), secondary, ghost
 * - size : sm, md, lg
 * - to : lien interne (react-router) ; href : lien externe ; sinon <button>.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  to,
  href,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const classes = `btn btn--${variant} btn--${size} ${className}`.trim()
  const iconSize = size === 'lg' ? 22 : size === 'sm' ? 16 : 20
  const content = (
    <>
      {icon && <Icon icon={icon} size={iconSize} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon icon={iconRight} size={iconSize} />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button type={type} className={classes} {...rest}>
      {content}
    </button>
  )
}
