export function starterFiles(name:string,template:string):{path:string,content:string}[]{
 const safe=name.replace(/[<>&"']/g,'');
 if(template==='android')return [
  {path:'settings.gradle.kts',content:'pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositories { google(); mavenCentral() } }\nrootProject.name="JojoApp"\ninclude(":app")'},
  {path:'build.gradle.kts',content:'plugins { id("com.android.application") version "8.7.3" apply false }'},
  {path:'app/build.gradle.kts',content:'plugins { id("com.android.application") }\nandroid { namespace="com.jojo.app"; compileSdk=35\n defaultConfig { applicationId="com.jojo.app"; minSdk=24; targetSdk=35; versionCode=1; versionName="1.0" } }'},
  {path:'app/src/main/AndroidManifest.xml',content:'<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:theme="@android:style/Theme.Material.Light.NoActionBar" android:label="JoJo App"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>'},
  {path:'app/src/main/java/com/jojo/app/MainActivity.java',content:'package com.jojo.app;\nimport android.app.Activity;import android.os.Bundle;import android.widget.TextView;\npublic class MainActivity extends Activity { public void onCreate(Bundle state) {super.onCreate(state);TextView text=new TextView(this);text.setText("Votre application Android");text.setTextSize(24);text.setPadding(32,64,32,32);setContentView(text);} }'},
  {path:'README.md',content:`# ${safe}\nProjet Android natif. Requiert JDK 17, Android SDK 35 et Gradle 8.9. Compilez avec gradle :app:assembleDebug. Installez l'APK dans le panneau Android. Base générique pour musique, vidéo, streaming, commerce, finance ou toute autre application selon votre cahier des charges. Aucun solde ou service distant préconfiguré.`},
 ];
 if(template==='react'||template==='react-native')return [
  {path:'package.json',content:JSON.stringify({name:'jojo-app',version:'1.0.0',private:true,scripts:{dev:'vite --host 0.0.0.0',build:'vite build'},dependencies:{react:'18.3.1','react-dom':'18.3.1'},devDependencies:{vite:'6.4.1',typescript:'5.5.3'}},null,2)},
  {path:'index.html',content:'<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>'},
  {path:'src/main.tsx',content:`import React from 'react';import {createRoot} from 'react-dom/client';\ncreateRoot(document.getElementById('root')!).render(<main style={{fontFamily:'system-ui',maxWidth:960,margin:'4rem auto',padding:24}}><h1>{${JSON.stringify(name)}}</h1><p>Votre projet React est prêt à être développé.</p></main>);`},
  {path:'README.md',content:'# Projet React\nInstallez les dépendances et compilez dans le worker isolé. Le code TypeScript nécessite une compilation avant aperçu.'},
 ];
 return [{path:'index.html',content:`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe}</title><style>body{margin:0;font:16px system-ui;background:#190a28;color:white}main{max-width:960px;margin:auto;padding:8vw}h1{font-size:clamp(2rem,6vw,4rem)}a{color:#a66be0}</style><main><h1>${safe}</h1><p>Votre espace de développement web.</p></main></html>`}];
}
