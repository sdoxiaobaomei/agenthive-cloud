{{/*
AgentHive Cloud Helm Chart - Common Helpers
*/}}

{{/* Expand the name of the chart */}}
{{- define "agenthive.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Create a default fully qualified app name */}}
{{- define "agenthive.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/* Chart name and version as used by the chart label */}}
{{- define "agenthive.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Common labels (without selector labels to avoid name conflicts on service-specific resources) */}}
{{- define "agenthive.labels" -}}
helm.sh/chart: {{ include "agenthive.chart" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.global.labels }}
{{- range $key, $value := .Values.global.labels }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}
{{- end }}

{{/* Selector labels */}}
{{- define "agenthive.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agenthive.name" . }}
{{- end }}

{{/* Service name helper for a specific service */}}
{{- define "agenthive.serviceName" -}}
{{- $global := index . 0 }}
{{- $service := index . 1 }}
{{- if $service.nameOverride }}
{{- $service.nameOverride }}
{{- else if $global.Values.global.namePrefix }}
{{- printf "%s%s" $global.Values.global.namePrefix $service.name }}
{{- else }}
{{- $service.name }}
{{- end }}
{{- end }}

{{/* Service labels helper */}}
{{- define "agenthive.serviceLabels" -}}
{{- $global := index . 0 }}
{{- $service := index . 1 }}
app.kubernetes.io/name: {{ include "agenthive.serviceName" (list $global $service) }}
app.kubernetes.io/component: {{ $service.component }}
app.kubernetes.io/managed-by: {{ $global.Release.Service }}
{{- if $global.Values.global.labels }}
{{- range $key, $value := $global.Values.global.labels }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}
{{- end }}

{{/* Service selector labels helper */}}
{{- define "agenthive.serviceSelectorLabels" -}}
{{- $global := index . 0 }}
{{- $service := index . 1 }}
app.kubernetes.io/name: {{ include "agenthive.serviceName" (list $global $service) }}
{{- end }}

{{/* Service account name */}}
{{- define "agenthive.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "agenthive.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* Image helper */}}
{{- define "agenthive.image" -}}
{{- $global := index . 0 }}
{{- $image := index . 1 }}
{{- $registry := default $global.Values.global.imageRegistry $image.registry }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $image.repository $image.tag }}
{{- else }}
{{- printf "%s:%s" $image.repository $image.tag }}
{{- end }}
{{- end }}

{{/* Namespace helper */}}
{{- define "agenthive.namespace" -}}
{{- default .Release.Namespace .Values.global.namespace }}
{{- end }}

{{/* Full image with pull policy */}}
{{- define "agenthive.containerImage" -}}
image: {{ include "agenthive.image" . }}
imagePullPolicy: {{ default "IfNotPresent" (index . 1).pullPolicy }}
{{- end }}

{{/* Prefix a name with global namePrefix if set */}}
{{- define "agenthive.prefixedName" -}}
{{- $global := index . 0 }}
{{- $name := index . 1 }}
{{- if $global.Values.global.namePrefix }}
{{- printf "%s%s" $global.Values.global.namePrefix $name }}
{{- else }}
{{- $name }}
{{- end }}
{{- end }}

{{/* API service full name */}}
{{- define "agenthive.apiName" -}}
{{- include "agenthive.prefixedName" (list . .Values.api.name) }}
{{- end }}

{{/* Landing service full name */}}
{{- define "agenthive.landingName" -}}
{{- include "agenthive.prefixedName" (list . .Values.landing.name) }}
{{- end }}
