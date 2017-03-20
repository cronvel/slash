#!/usr/bin/env node

"use strict" ;

var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;

term.getCursorLocation( ( error , x , y ) => {
	if ( error ) { console.log( error ) ; }
	console.log( 'x,y =' , x , y ) ;
	
	term.getCursorLocation( ( error , x , y ) => {
		if ( error ) { console.log( error ) ; }
		console.log( 'x,y =' , x , y ) ;
	} ) ;
} ) ;
