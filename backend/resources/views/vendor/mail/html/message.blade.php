<x-mail::layout>
<x-slot:header>
<x-mail::header :url="config('app.frontend_url')">
Rentivo
</x-mail::header>
</x-slot:header>

{!! $slot !!}

@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

<x-slot:footer>
<x-mail::footer>
© {{ date('Y') }} Rentivo. {{ __('All rights reserved.') }}
<br>
Need help? <a href="mailto:{{ config('mail.from.address') }}">Contact Rentivo support</a>.
</x-mail::footer>
</x-slot:footer>
</x-mail::layout>
