#!/usr/bin/env node
/*
	Slash
	
	Copyright (c) 2017 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/
"use strict" ;

var ptySpawn = require( 'child_pty' ).spawn ;

var triggered = false ;

var triggerCallback = ( error , code , signal ) => {
	
	if ( triggered ) { return ; }
	triggered = true ;
	
	process.stdin.removeListener( 'data' , onStdin ) ;
	child.stdout.removeListener( 'data' , onStdout ) ;
	
	child.removeListener( 'error' , onError ) ;
	child.removeListener( 'exit' , onExit ) ;
	
	if ( error ) { console.log( error ) ; }
	
	process.stdin.setRawMode( false ) ;
	process.exit() ;
} ;

var onError = error => {
	triggerCallback( error ) ;
} ;

var onExit = ( code , signal ) => {
	triggerCallback( null , code , signal ) ;
} ;

var onStdin = chunk => {
	//console.log( "stdin" , chunk ) ;
	child.stdin.write( chunk ) ;
} ;

var onStdout = chunk => {
	//console.error( "\nstdout: " + string.escape.control( chunk.toString() ) + '\n\n' ) ;
	process.stdout.write( chunk ) ;
} ;

var onStderr = chunk => {
	//console.log( "stderr" , chunk ) ;
	process.stderr.write( chunk ) ;
} ;

process.stdin.setRawMode( true ) ;

var child = ptySpawn( process.argv[ 2 ] , process.argv.slice( 3 ) , {
	cwd: process.cwd() ,
	env: process.env ,
	shell: false ,
	columns: process.stdout.columns ,
	rows: process.stdout.rows
} ) ;


process.stdin.on( 'data' , onStdin ) ;
child.stdout.on( 'data' , onStdout ) ;

child.on( 'error' , onError ) ;
child.on( 'exit' , onExit ) ;
