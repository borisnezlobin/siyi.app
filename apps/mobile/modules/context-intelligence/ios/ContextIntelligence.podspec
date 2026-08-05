Pod::Spec.new do |s|
  s.name           = 'ContextIntelligence'
  s.version        = '1.0.0'
  s.summary        = 'Private on-device conversation prompts'
  s.description    = 'An Expo module that uses Apple Foundation Models when available.'
  s.author         = 'siyi.app'
  s.homepage       = 'https://siyi.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
