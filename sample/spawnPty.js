#!/usr/bin/env node

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
