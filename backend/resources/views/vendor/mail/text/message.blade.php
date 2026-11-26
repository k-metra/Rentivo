Rentivo - Vehicle rentals, made simple.
{{ config('app.frontend_url') }}

{!! strip_tags($slot) !!}
@isset($subcopy)

{!! strip_tags($subcopy) !!}
@endisset

© {{ date('Y') }} Rentivo. {{ __('All rights reserved.') }}
Need help? Contact Rentivo support at {{ config('mail.from.address') }}.
