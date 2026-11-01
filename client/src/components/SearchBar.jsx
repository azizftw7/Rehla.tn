import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import Button from './Button.jsx'
import Icon from './Icon.jsx'
import './SearchBar.css'

/**
 * Champ de recherche avec son bouton. Appelle onSearch(texte) à la validation.
 * size : md ou lg (grande barre de l'accueil).
 */
export default function SearchBar({
  label = 'Destination',
  placeholder = 'Où allez-vous ? Djerba, Tozeur, Sidi Bou Saïd…',
  buttonLabel = 'Rechercher',
  size = 'md',
  defaultValue = '',
  onSearch,
  inputRef,
  inputId,
}) {
  const generatedId = useId()
  const id = inputId ?? generatedId
  const [value, setValue] = useState(defaultValue)

  const handleSubmit = (event) => {
    event.preventDefault()
    onSearch?.(value.trim())
  }

  return (
    <form role="search" className={`searchbar searchbar--${size}`} onSubmit={handleSubmit}>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <Icon icon={Search} size={size === 'lg' ? 24 : 20} className="searchbar__icon" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        className="searchbar__input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      <Button type="submit" variant="primary" size={size === 'lg' ? 'lg' : 'md'}>
        {buttonLabel}
      </Button>
    </form>
  )
}
