import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import Icon from '../../components/Icon.jsx'

/** Champ mot de passe avec un bouton pour l'afficher ou le masquer. */
export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="auth-form__password">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="auth-form__toggle"
        aria-controls={props.id}
        aria-pressed={visible}
        aria-label="Afficher le mot de passe"
        title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon icon={visible ? EyeOff : Eye} size={18} />
      </button>
    </div>
  )
}
