'use client'

import { useState } from 'react'
import { FileUpload } from '@/components/upload/FileUpload'
import { ParseResults } from '@/components/results/ParseResults'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setUploadResult(null)
  }

  const handleFileRemove = () => {
    setSelectedFile(null)
    setUploadResult(null)
  }

  const handleUploadComplete = (result: any) => {
    setUploadResult(result)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Kabisa WKR Beoordelaar 2025
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Automatische analyse van XAF bestanden voor Nederlandse Werkkostenregeling
          </p>

          <ErrorBoundary>
            <FileUpload
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              onUploadComplete={handleUploadComplete}
            />

            {/* Upload Result Display */}
            {uploadResult && (
              <div className="mt-8 max-w-6xl mx-auto">
                <ErrorBoundary>
                  <ParseResults result={uploadResult} />
                </ErrorBoundary>
              </div>
            )}
          </ErrorBoundary>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-3 w-12 h-12 mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">XAF Parsing</h3>
              <p className="text-gray-600">Automatische parsing en validatie van Nederlandse XAF bestanden</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 rounded-full p-3 w-12 h-12 mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Analyse</h3>
              <p className="text-gray-600">Geavanceerde WKR analyse met Google Gemini AI</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-3 w-12 h-12 mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Rapportage</h3>
              <p className="text-gray-600">Uitgebreide rapporten en aanbevelingen</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}