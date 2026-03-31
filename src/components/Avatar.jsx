export default function Avatar({ url, name, size = 'md' }) {
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-16 h-16 text-xl', xl: 'w-24 h-24 text-3xl' }
  const initials = name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?'

  if (url) {
    return (
      <img
        src={url}
        alt={name || ''}
        className={`${sizes[size]} rounded-full object-cover bg-brand-100`}
        onError={e => {
          e.target.style.display = 'none'
          e.target.nextSibling.style.display = 'flex'
        }}
      />
    )
  }

  return (
    <div className={`${sizes[size]} rounded-full bg-brand-500 text-white flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  )
}

// Compound version that handles broken img gracefully
export function AvatarWithFallback({ url, name, size = 'md' }) {
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-16 h-16 text-xl', xl: 'w-24 h-24 text-3xl' }
  const initials = name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?'

  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden shrink-0 relative`}>
      {url ? (
        <img
          src={url}
          alt={name || ''}
          className="w-full h-full object-cover"
          onError={e => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.parentElement.classList.add('bg-brand-500')
            const span = document.createElement('span')
            span.className = 'absolute inset-0 flex items-center justify-center text-white font-semibold'
            span.textContent = initials
            e.currentTarget.parentElement.appendChild(span)
          }}
        />
      ) : (
        <div className={`w-full h-full bg-brand-500 text-white flex items-center justify-center font-semibold`}>
          {initials}
        </div>
      )}
    </div>
  )
}
