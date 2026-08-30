$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$text = Get-Content "D:\ledgersentry\scripts\narration.txt" -Raw
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints("Female")
$synth.Rate = 0
$synth.SetOutputToWaveFile("C:\Users\Asef\AppData\Local\Temp\opencode\narration.wav")
$synth.Speak($text)
$synth.Dispose()
"narration.wav generated"
